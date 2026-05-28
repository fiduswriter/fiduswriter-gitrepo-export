from django.contrib import admin
from django.apps import apps

from . import models


if apps.is_installed("book"):

    class BookRepositoryAdmin(admin.ModelAdmin):
        pass

    admin.site.register(models.BookRepository, BookRepositoryAdmin)


class DocumentRepositoryAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.DocumentRepository, DocumentRepositoryAdmin)


class GitServerAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.GitServer, GitServerAdmin)


class RepoInfoAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.RepoInfo, RepoInfoAdmin)
