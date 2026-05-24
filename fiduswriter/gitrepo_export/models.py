from django.apps import apps
from django.db import models
from django.conf import settings as django_settings

REPO_TYPES = (
    ("github", "GitHub"),
    ("gitlab", "GitLab"),
    ("forgejo", "Forgejo"),
)

if apps.is_installed("book"):

    class BookRepository(models.Model):
        book = models.ForeignKey(
            "book.Book", on_delete=models.deletion.CASCADE
        )
        repo_id = models.IntegerField()
        repo_name = models.CharField(max_length=256)
        repo_type = models.CharField(max_length=8, choices=REPO_TYPES)
        targets = models.JSONField(default=list, blank=True)

        class Meta(object):
            verbose_name_plural = "Book repositories"


class DocumentRepository(models.Model):
    document = models.ForeignKey("document.Document", on_delete=models.CASCADE)
    repo_id = models.IntegerField()
    repo_name = models.CharField(max_length=256)
    repo_type = models.CharField(max_length=8, choices=REPO_TYPES)
    targets = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name_plural = "Document repositories"


class ForgejoServer(models.Model):
    user = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    instance_url = models.URLField(
        help_text="Base URL of the Forgejo instance (e.g. https://code.example.org)"
    )
    name = models.CharField(
        max_length=128,
        blank=True,
        help_text="A label to identify this instance",
    )
    token = models.CharField(
        max_length=256,
        help_text="Personal Access Token with repo scope",
    )
    active = models.BooleanField(default=True)
    added = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Forgejo servers"


class RepoInfo(models.Model):
    user = models.OneToOneField(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.deletion.CASCADE,
    )
    content = models.JSONField(default=list, null=True, blank=True)

    def __str__(self):
        return self.user.readable_name
