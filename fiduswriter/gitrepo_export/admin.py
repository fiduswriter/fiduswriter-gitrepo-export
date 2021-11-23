from django.contrib import admin
from . import models


class BookRepositoryAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.BookRepository, BookRepositoryAdmin)


class RepoInfoAdmin(admin.ModelAdmin):
    pass


admin.site.register(models.RepoInfo, RepoInfoAdmin)
