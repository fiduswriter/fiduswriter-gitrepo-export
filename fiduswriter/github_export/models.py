from django.db import models
from django.conf import settings as django_settings
from book.models import Book


class BookRepository(models.Model):
    book = models.ForeignKey(Book, on_delete=models.deletion.CASCADE)
    github_repo_id = models.IntegerField()
    github_repo_full_name = models.CharField(
        max_length=256,
    )
    export_epub = models.BooleanField()
    export_unpacked_epub = models.BooleanField()
    export_html = models.BooleanField()
    export_unified_html = models.BooleanField()
    export_latex = models.BooleanField()

    class Meta(object):
        verbose_name_plural = "Book repositories"


class RepoInfo(models.Model):
    user = models.OneToOneField(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.deletion.CASCADE,
    )
    content = models.JSONField(default=list, null=True, blank=True)

    def __str__(self):
        return self.user.readable_name
