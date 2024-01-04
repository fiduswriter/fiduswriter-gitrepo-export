fiduswriter-gitrepo-export
==========================

A plugin to export books to GitLab/GitHub.

To install:
-----------

1. Make sure you have installed the `fiduswriter-books` plugin and you have updated both `fiduswriter` and `fiduswriter-books` to the latest patch release.

2. Install this plugin (for example by running ``pip install fiduswriter-gitrepo-export``).

3. Enter the configuration file in an editor. If you have installed the Snap, you do this by running ``sudo fiduswriter.configure``. Otherwise open the file `configuration.py` in a text editor.

4. The default maximum size of a book is 2.5 MB. If some of your files will be larger than that, adjust ``DATA_UPLOAD_MAX_MEMORY_SIZE`` to something higher, for example 10MiB::

```python
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760
```

5. Add "gitrepo_export" to ``INSTALLED_APPS``.

*For GitHub*

6a. Add "allauth.socialaccount.providers.github" to ``INSTALLED_APPS``.

7a. Add repo rights for the github connector like this::

```python
SOCIALACCOUNT_PROVIDERS = {
    'github': {
        'SCOPE': [
            'repo',
            'user:email',
        ],
    }
}
```

8a. Exit the editor and save the configuration file.

9a. Set up GitHub as one of the connected login options. See instructions here: https://docs.allauth.org/en/latest/socialaccount/providers/github.html . The callback URL will be in the format https://DOMAIN.NAME/api/github/github/login/callback/

*For GitLab*

6b. Add "allauth.socialaccount.providers.gitlab" to ``INSTALLED_APPS``.

7b. Add repo rights for the gitlab connector like this::

```python
SOCIALACCOUNT_PROVIDERS = {
    'gitlab': {
        'SCOPE': [
            'api',
        ],
    }
}
```

8b. Exit the editor and save the configuration file.

9b. Set up GitLab as one of the connected login options. See instructions here: https://docs.allauth.org/en/latest/socialaccount/providers/gitlab.html . The callback URL will be in the format https://DOMAIN.NAME/api/gitlab/gitlab/login/callback/



To use:
-------

1. Login to your Fidus Writer instance using GitHub/GitLab, or login with a regular account and connect a Gitlab/Github account on the profile page (https://DOMAIN.NAME/user/profile/)

2. Go to the books overview page.

3. Enter a book to set the gitrepo settings for the book.

4. Select the book in the overview and export to gitrepo via the dropdown menu.
