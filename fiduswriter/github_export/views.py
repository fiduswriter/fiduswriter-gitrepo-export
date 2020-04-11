from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET, require_POST
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
from base.decorators import ajax_required
from django.db.models import Q
from book.models import Book
from . import models


@login_required
@ajax_required
@require_GET
def get_book_repos(request):
    response = {}
    status = 200
    book_repos = models.BookRepository.objects.filter(
        Q(book__owner=request.user) |
        Q(book__bookaccessright__user=request.user)
    ).distinct()
    response['book_repos'] = {}
    for repo in book_repos:
        response['book_repos'][repo.book.id] = {
            'github_repo_id': repo.github_repo_id,
            'github_repo_full_name': repo.github_repo_full_name,
            'export_epub': repo.export_epub,
            'export_unpacked_epub': repo.export_unpacked_epub,
            'export_html': repo.export_html,
            'export_latex': repo.export_latex
        }
    return JsonResponse(
        response,
        status=status
    )


@login_required
@ajax_required
@require_POST
def update_book_repo(request):
    book_id = request.POST['book_id']
    book = Book.objects.filter(id=book_id).first()
    if (
        not book or
        (
            book.owner != request.user and
            not book.bookaccessright_set.filter(
                user=request.user,
                rights='write'
            ).exists()
        )
    ):
        return HttpResponseForbidden()
    models.BookRepository.objects.filter(book_id=book_id).delete()
    github_repo_id = request.POST['github_repo_id']
    if github_repo_id == 0:
        status = 200
    else:
        models.BookRepository.objects.create(
            book_id=book_id,
            github_repo_id=github_repo_id,
            github_repo_full_name=request.POST['github_repo_full_name'],
            export_epub=request.POST['export_epub']=='true',
            export_unpacked_epub=request.POST['export_unpacked_epub']=='true',
            export_html=request.POST['export_html']=='true',
            export_latex=request.POST['export_latex']=='true',
        )
        status = 201
    return HttpResponse(status=status)
