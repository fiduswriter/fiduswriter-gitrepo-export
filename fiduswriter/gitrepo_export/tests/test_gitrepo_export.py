import time
import json
import multiprocessing
from http.server import BaseHTTPRequestHandler, HTTPServer
import socket
from urllib.parse import urljoin

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.wait import WebDriverWait
from testing.liveserver import ChannelsLiveServerTestCase
from testing.selenium_helper import SeleniumHelper

from django.conf import settings
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp, SocialAccount, SocialToken

from allauth.socialaccount.providers import registry
from allauth.socialaccount.providers.github.provider import GitHubProvider
from allauth.socialaccount.providers.gitlab.provider import GitLabProvider
from django.apps import apps
from gitrepo_export import models

books_installed = apps.is_installed("book")
if books_installed:
    from book.models import Book


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


def get_free_port():
    s = socket.socket(socket.AF_INET, type=socket.SOCK_STREAM)
    s.bind(("localhost", 0))
    address, port = s.getsockname()
    s.close()
    return port


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
        # Register the GitHub provider with allauth so the configuration
        # view can resolve social accounts for the logged-in user.
        registry.register(GitHubProvider)
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
        site = Site.objects.get_current()
        social_app = SocialApp.objects.create(
            provider="github",
            name="GitHub",
            client_id="mock-client-id",
            secret="mock-secret",
        )
        social_app.sites.add(site)
        social_account = SocialAccount.objects.create(
            user=self.user,
            provider="github",
            uid="12345",
        )
        SocialToken.objects.create(
            account=social_account,
            token="mock-github-token",
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
        if self.path.startswith("/projects?min_access_level=30&simple=true"):
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
        if self.path.startswith("/projects/456/repository/tree"):
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
        if self.path == "/projects/456/repository/commits":
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
        # Register the GitLab provider with allauth so the configuration
        # view can resolve social accounts for the logged-in user.
        registry.register(GitLabProvider)
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
        site = Site.objects.get_current()
        social_app = SocialApp.objects.create(
            provider="gitlab",
            name="GitLab",
            client_id="mock-client-id",
            secret="mock-secret",
        )
        social_app.sites.add(site)
        social_account = SocialAccount.objects.create(
            user=self.user,
            provider="gitlab",
            uid="12345",
        )
        SocialToken.objects.create(
            account=social_account,
            token="mock-gitlab-token",
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
