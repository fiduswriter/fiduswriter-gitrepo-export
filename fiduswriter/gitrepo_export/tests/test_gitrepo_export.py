import time
import json
import multiprocessing
from http.server import BaseHTTPRequestHandler, HTTPServer
import socket
from urllib.parse import urljoin

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait
from testing.live_server import ChannelsLiveServerTestCase
from testing.selenium_helper import SeleniumHelper

from django.conf import settings
from django.apps import apps
from gitrepo_export import models

books_installed = apps.is_installed("book")
if books_installed:
    from book.models import Book


def get_free_port():
    s = socket.socket(socket.AF_INET, type=socket.SOCK_STREAM)
    s.bind(("localhost", 0))
    address, port = s.getsockname()
    s.close()
    return port


class MockGitHubHandler(BaseHTTPRequestHandler):
    sha_counter = 0

    def log_message(self, format, *args):
        with open("/tmp/mock_github.log", "a") as f:
            f.write(f"{self.command} {self.path}\n")

    def _next_sha(self):
        MockGitHubHandler.sha_counter += 1
        return f"sha{MockGitHubHandler.sha_counter:04d}"

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode(encoding="utf_8"))

    def do_GET(self):
        if self.path.startswith("/user/repos"):
            self._send_json(
                [
                    {
                        "id": 123,
                        "full_name": "testuser/testrepo",
                        "default_branch": "main",
                    }
                ]
            )
            return
        if self.path == "/repos/testuser/testrepo":
            self._send_json({"default_branch": "main", "id": 123})
            return
        if self.path == "/repos/testuser/testrepo/git/refs/heads/main":
            self._send_json({"object": {"sha": "abc123"}})
            return
        if self.path.startswith("/repos/testuser/testrepo/contents/"):
            self._send_json([])
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/repos/testuser/testrepo/git/blobs":
            self._send_json({"sha": self._next_sha()})
            return
        if self.path == "/repos/testuser/testrepo/git/trees":
            self._send_json({"sha": self._next_sha()})
            return
        if self.path == "/repos/testuser/testrepo/git/commits":
            self._send_json({"sha": self._next_sha()})
            return
        self.send_response(404)
        self.end_headers()

    def do_PATCH(self):
        if self.path == "/repos/testuser/testrepo/git/refs/heads/main":
            self._send_json({"object": {"sha": "newsha123"}})
            return
        self.send_response(404)
        self.end_headers()


class GitrepoExportDummyTest(SeleniumHelper, ChannelsLiveServerTestCase):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def start_server(cls, port):
        httpd = HTTPServer(("", port), MockGitHubHandler)
        httpd.serve_forever()

    @classmethod
    def setUpClass(cls):
        # Start the mock GitHub server and set GITHUB_API_URL BEFORE
        # super().setUpClass() so the forked Daphne process inherits it.
        cls.server_port = get_free_port()
        cls.server = multiprocessing.Process(
            target=cls.start_server, args=(cls.server_port,)
        )
        cls.server.daemon = True
        cls.server.start()
        settings.GITHUB_API_URL = f"http://localhost:{cls.server_port}"
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        cls.server.terminate()
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="User1", email="user1@user.com", passtext="password"
        )
        # Create a GitHub server entry with a PAT
        self.github_server = models.GitServer.objects.create(
            user=self.user,
            server_type="github",
            instance_url="",
            name="Mock GitHub",
            token="mock-github-token",
        )
        # Pre-populate cached repo info
        models.RepoInfo.objects.create(
            user=self.user,
            content=[
                {
                    "type": "github",
                    "name": "testuser/testrepo",
                    "id": 123,
                    "branch": "main",
                }
            ],
        )

    def create_document(self, title="Chapter 1"):
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            title
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()

    def test_gitrepo_export_dummy(self):
        try:
            self.login_user(self.user, self.driver, self.client)
            self.driver.get(urljoin(self.base_url, "/"))

            # Create a document
            self.create_document("Chapter 1")

            # Go to books overview
            WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, 'a[href="/books/"]')
                )
            ).click()

            # Create a new book
            WebDriverWait(self.driver, self.wait_time).until(
                EC.element_to_be_clickable(
                    (
                        By.CSS_SELECTOR,
                        'button[title="Create new book (Alt-n)"]',
                    )
                )
            ).click()
            self.driver.find_element(By.ID, "book-title").send_keys("My book")
            self.driver.find_element(
                By.CSS_SELECTOR, 'a[href="#optionTab1"]'
            ).click()
            self.driver.find_element(
                By.CSS_SELECTOR, "#book-document-list .file .file-name"
            ).click()
            self.driver.find_element(By.ID, "add-chapter").click()

            # Open Git repository tab
            self.driver.find_element(
                By.XPATH, '//*[normalize-space()="Git repository"]'
            ).click()

            # Wait for repo selector to load
            WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (By.ID, "book-settings-repository")
                )
            )

            # Select the mock repository
            repo_select = WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (By.ID, "book-settings-repository")
                )
            )
            self.driver.execute_script(
                'arguments[0].value = "github-123"; arguments[0].dispatchEvent(new Event("change"));',
                repo_select,
            )

            # Enable EPUB export
            epub_checkbox = WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, '.export-format[data-key="epub"]')
                )
            )
            self.driver.execute_script("arguments[0].click();", epub_checkbox)

            # Save the book
            submit_btn = WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (
                        By.XPATH,
                        '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
                    )
                )
            )
            self.driver.execute_script("arguments[0].click();", submit_btn)
            time.sleep(2)

            # Verify BookRepository was created
            book = Book.objects.filter(owner=self.user).first()
            self.assertIsNotNone(book)
            book_repo = models.BookRepository.objects.filter(book=book).first()
            self.assertIsNotNone(book_repo)
            self.assertEqual(book_repo.repo_id, 123)
            self.assertEqual(book_repo.repo_name, "testuser/testrepo")
            self.assertEqual(book_repo.repo_type, "github")
            self.assertIn("epub", book_repo.targets)

            # Go back to books overview
            self.driver.get(urljoin(self.base_url, "/books/"))
            time.sleep(1)

            # Select the book
            self.driver.find_element(
                By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
            ).click()

            # Open bulk dropdown and click Export to Git Repository
            WebDriverWait(self.driver, self.wait_time).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, ".dt-bulk-dropdown")
                )
            ).click()
            git_export_btn = WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (
                        By.XPATH,
                        '//*[normalize-space()="Export to Git Repository"]',
                    )
                )
            )
            # Dispatch a proper bubbling click event that ContentMenu can handle
            self.driver.execute_script(
                """
                var el = arguments[0];
                var evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                el.dispatchEvent(evt);
            """,
                git_export_btn,
            )

            # Enter commit message
            WebDriverWait(self.driver, self.wait_time).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, ".commit-message")
                )
            )
            self.driver.find_element(
                By.CSS_SELECTOR, ".commit-message"
            ).send_keys("Test commit")
            submit_btn2 = self.driver.find_element(
                By.XPATH,
                '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
            )
            self.driver.execute_script("arguments[0].click();", submit_btn2)

            # Wait for success alert (may take a while for EPUB generation + API calls)
            WebDriverWait(self.driver, 60).until(
                EC.presence_of_element_located(
                    (
                        By.CSS_SELECTOR,
                        "body #alerts-outer-wrapper .alerts-info",
                    )
                )
            )

            # The first .alerts-info may be the "initiated" message; wait for the
            # success message specifically by polling text content.
            def success_alert_present(driver):
                alerts = driver.find_elements(
                    By.CSS_SELECTOR, "body #alerts-outer-wrapper .alerts-info"
                )
                for alert in alerts:
                    if (
                        "Book published to repository successfully!"
                        in alert.text
                    ):
                        return alert
                return False

            alert = WebDriverWait(self.driver, 60).until(success_alert_present)
            self.assertIn(
                "Book published to repository successfully!",
                alert.text,
            )
        except Exception:
            raise


class MockGitLabHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        with open("/tmp/mock_gitlab.log", "a") as f:
            f.write(f"{self.command} {self.path}\n")

    def _send_json(self, data, status=200, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(data).encode(encoding="utf_8"))

    def do_GET(self):
        if self.path.startswith(
            "/api/v4/projects?min_access_level=30&simple=true"
        ):
            self._send_json(
                [
                    {
                        "id": 456,
                        "path_with_namespace": "testuser/testgitlabrepo",
                        "default_branch": "main",
                    }
                ]
            )
            return
        if self.path.startswith("/api/v4/projects/456/repository/tree"):
            # Link header is required by gitlab.get_repo even for empty results
            self._send_json(
                [],
                extra_headers={
                    "Link": '<http://localhost/dummy>; rel="first"'
                },
            )
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/v4/projects/456/repository/commits":
            self._send_json({"id": "commit123", "short_id": "commit123"})
            return
        self.send_response(404)
        self.end_headers()


class GitlabExportDummyTest(SeleniumHelper, ChannelsLiveServerTestCase):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
        "initial_book_data.json",
    ]

    @classmethod
    def start_server(cls, port):
        httpd = HTTPServer(("", port), MockGitLabHandler)
        httpd.serve_forever()

    @classmethod
    def setUpClass(cls):
        # Start the mock GitLab server and set GITLAB_API_URL BEFORE
        # super().setUpClass() so the forked Daphne process inherits it.
        cls.server_port = get_free_port()
        cls.server = multiprocessing.Process(
            target=cls.start_server, args=(cls.server_port,)
        )
        cls.server.daemon = True
        cls.server.start()
        settings.GITLAB_API_URL = f"http://localhost:{cls.server_port}"
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        cls.server.terminate()
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="User1", email="user1@user.com", passtext="password"
        )
        # Create a GitLab server entry with a PAT
        self.gitlab_server = models.GitServer.objects.create(
            user=self.user,
            server_type="gitlab",
            instance_url=f"http://localhost:{self.server_port}",
            name="Mock GitLab",
            token="mock-gitlab-token",
        )
        # Pre-populate cached repo info
        models.RepoInfo.objects.create(
            user=self.user,
            content=[
                {
                    "type": "gitlab",
                    "name": "testuser/testgitlabrepo",
                    "id": 456,
                    "branch": "main",
                }
            ],
        )

    def create_document(self, title="Chapter 1"):
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            title
        )
        time.sleep(1)
        self.driver.find_element(By.ID, "close-document-top").click()

    def test_gitlab_export_dummy(self):
        self.login_user(self.user, self.driver, self.client)
        self.driver.get(urljoin(self.base_url, "/"))

        # Create a document
        self.create_document("Chapter 1")

        # Go to books overview
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'a[href="/books/"]')
            )
        ).click()

        # Create a new book
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[title="Create new book (Alt-n)"]')
            )
        ).click()
        self.driver.find_element(By.ID, "book-title").send_keys(
            "My GitLab book"
        )
        self.driver.find_element(
            By.CSS_SELECTOR, 'a[href="#optionTab1"]'
        ).click()
        self.driver.find_element(
            By.CSS_SELECTOR, "#book-document-list .file .file-name"
        ).click()
        self.driver.find_element(By.ID, "add-chapter").click()

        # Open Git repository tab
        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Git repository"]'
        ).click()

        # Wait for repo selector to load
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "book-settings-repository"))
        )

        # Select the mock GitLab repository
        repo_select = WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "book-settings-repository"))
        )
        self.driver.execute_script(
            'arguments[0].value = "gitlab-456"; arguments[0].dispatchEvent(new Event("change"));',
            repo_select,
        )

        # Enable EPUB export
        self.driver.find_element(
            By.CSS_SELECTOR, '.export-format[data-key="epub"]'
        ).click()

        # Save the book
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
        ).click()
        time.sleep(2)

        # Verify BookRepository was created
        book = Book.objects.filter(owner=self.user).first()
        self.assertIsNotNone(book)
        book_repo = models.BookRepository.objects.filter(book=book).first()
        self.assertIsNotNone(book_repo)
        self.assertEqual(book_repo.repo_id, 456)
        self.assertEqual(book_repo.repo_name, "testuser/testgitlabrepo")
        self.assertEqual(book_repo.repo_type, "gitlab")
        self.assertIn("epub", book_repo.targets)

        # Go back to books overview
        self.driver.get(urljoin(self.base_url, "/books/"))
        time.sleep(1)

        # Select the book
        self.driver.find_element(
            By.CSS_SELECTOR, "tr:nth-child(1) > td > label"
        ).click()

        # Open bulk dropdown and click Export to Git Repository
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".dt-bulk-dropdown"))
        ).click()

        self.driver.find_element(
            By.XPATH, '//*[normalize-space()="Export to Git Repository"]'
        ).click()

        # Enter commit message
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".commit-message")
            )
        )
        self.driver.find_element(By.CSS_SELECTOR, ".commit-message").send_keys(
            "Test GitLab commit"
        )
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
        ).click()

        # Wait for success alert (may take a while for EPUB generation + API calls)
        WebDriverWait(self.driver, 60).until(
            EC.presence_of_element_located(
                (
                    By.CSS_SELECTOR,
                    "body #alerts-outer-wrapper .alerts-info",
                )
            )
        )

        # The first .alerts-info may be the "initiated" message; wait for the
        # success message specifically by polling text content.
        def success_alert_present(driver):
            alerts = driver.find_elements(
                By.CSS_SELECTOR, "body #alerts-outer-wrapper .alerts-info"
            )
            for alert in alerts:
                if "Book published to repository successfully!" in alert.text:
                    return alert
            return False

        alert = WebDriverWait(self.driver, 60).until(success_alert_present)
        self.assertIn(
            "Book published to repository successfully!",
            alert.text,
        )


class MockForgejoHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        with open("/tmp/mock_forgejo.log", "a") as f:
            f.write(f"{self.command} {self.path}\n")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode(encoding="utf_8"))

    def do_GET(self):
        if self.path.startswith("/api/v1/user/repos"):
            self._send_json(
                [
                    {
                        "id": 789,
                        "full_name": "testuser/testforgejorepo",
                        "default_branch": "main",
                    }
                ]
            )
            return
        if self.path.startswith(
            "/api/v1/repos/testuser/testforgejorepo/git/trees/main"
        ):
            self._send_json({"tree": []})
            return
        if self.path.startswith(
            "/api/v1/repos/testuser/testforgejorepo/contents/"
        ):
            self._send_json({"sha": "abc123", "content": ""})
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path.startswith(
            "/api/v1/repos/testuser/testforgejorepo/contents"
        ):
            self._send_json({"commit": {"id": "commit123"}})
            return
        self.send_response(404)
        self.end_headers()


class ForgejoDocumentExportTest(SeleniumHelper, ChannelsLiveServerTestCase):
    fixtures = [
        "initial_documenttemplates.json",
        "initial_styles.json",
    ]

    @classmethod
    def start_server(cls, port):
        httpd = HTTPServer(("", port), MockForgejoHandler)
        httpd.serve_forever()

    @classmethod
    def setUpClass(cls):
        cls.server_port = get_free_port()
        cls.server = multiprocessing.Process(
            target=cls.start_server, args=(cls.server_port,)
        )
        cls.server.daemon = True
        cls.server.start()
        super().setUpClass()
        cls.base_url = cls.live_server_url
        driver_data = cls.get_drivers(1)
        cls.driver = driver_data["drivers"][0]
        cls.client = driver_data["clients"][0]
        cls.driver.implicitly_wait(driver_data["wait_time"])
        cls.wait_time = driver_data["wait_time"]

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()
        cls.server.terminate()
        super().tearDownClass()

    def setUp(self):
        self.user = self.create_user(
            username="User1", email="user1@user.com", passtext="password"
        )
        # Create a Forgejo server linked to the mock instance
        self.forgejo_server = models.GitServer.objects.create(
            user=self.user,
            server_type="forgejo",
            instance_url=f"http://localhost:{self.server_port}",
            name="Mock Forgejo",
            token="mock-forgejo-token",
        )
        # Pre-populate cached repo info so the overview/editor loads repos
        # without hitting the mock server during initial render
        models.RepoInfo.objects.create(
            user=self.user,
            content=[
                {
                    "type": "forgejo",
                    "server_id": self.forgejo_server.id,
                    "name": "testuser/testforgejorepo",
                    "id": 789,
                    "branch": "main",
                }
            ],
        )

    def create_document(self, title="Test Doc"):
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, ".new_document button")
            )
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.CLASS_NAME, "editor-toolbar"))
        )
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").click()
        self.driver.find_element(By.CSS_SELECTOR, ".doc-title").send_keys(
            title
        )
        time.sleep(1)

    def test_forgejo_document_export(self):
        from document.models import Document

        self.login_user(self.user, self.driver, self.client)
        self.driver.get(urljoin(self.base_url, "/"))

        # Create a document
        self.create_document("Forgejo Export Doc")

        # Open Settings → Git Repository
        self.driver.find_element(
            By.CSS_SELECTOR, ".header-menu:nth-child(3) > .header-nav-item"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.XPATH, '//*[normalize-space()="Git Repository"]')
            )
        ).click()

        # Wait for the dialog to render
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located((By.ID, "doc-settings-repository"))
        )

        # Select the mock Forgejo repository
        repo_select = self.driver.find_element(
            By.ID, "doc-settings-repository"
        )
        self.driver.execute_script(
            'arguments[0].value = "forgejo-789"; arguments[0].dispatchEvent(new Event("change"));',
            repo_select,
        )

        # Enable HTML export
        html_checkbox = self.driver.find_element(
            By.CSS_SELECTOR, '.export-format[data-key="html"]'
        )
        if not html_checkbox.is_selected():
            self.driver.execute_script("arguments[0].click();", html_checkbox)

        # Save the settings
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
        ).click()

        time.sleep(1)

        # Verify DocumentRepository was created
        doc = Document.objects.filter(owner=self.user).first()
        self.assertIsNotNone(doc)
        doc_repo = models.DocumentRepository.objects.filter(
            document=doc
        ).first()
        self.assertIsNotNone(doc_repo)
        self.assertEqual(doc_repo.repo_id, 789)
        self.assertEqual(doc_repo.repo_name, "testuser/testforgejorepo")
        self.assertEqual(doc_repo.repo_type, "forgejo")
        self.assertIn("html", doc_repo.targets)

        # Export to Git Repository via File menu
        self.driver.find_element(
            By.CSS_SELECTOR, ".header-menu:nth-child(1) > .header-nav-item"
        ).click()
        WebDriverWait(self.driver, self.wait_time).until(
            EC.element_to_be_clickable(
                (By.XPATH, '//*[normalize-space()="Export to Git Repository"]')
            )
        ).click()

        # Enter commit message
        WebDriverWait(self.driver, self.wait_time).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, ".commit-message")
            )
        )
        self.driver.find_element(By.CSS_SELECTOR, ".commit-message").send_keys(
            "Test Forgejo commit"
        )
        self.driver.find_element(
            By.XPATH,
            '//*[contains(@class, "ui-button") and normalize-space()="Submit"]',
        ).click()

        # Wait for success alert
        def success_alert_present(driver):
            alerts = driver.find_elements(
                By.CSS_SELECTOR, "body #alerts-outer-wrapper .alerts-info"
            )
            for alert in alerts:
                if (
                    "Document published to repository successfully!"
                    in alert.text
                ):
                    return alert
            return False

        alert = WebDriverWait(self.driver, 60).until(success_alert_present)
        self.assertIn(
            "Document published to repository successfully!",
            alert.text,
        )
