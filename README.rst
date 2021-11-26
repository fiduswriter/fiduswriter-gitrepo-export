**************************
fiduswriter-gitrepo-export
**************************
A plugin to export books to GitLab/GitHub.

**This plugin is currently in early-stage development. It has not reached production level quality yet.**

To install:

1. Make sure you have installed the `fiduswriter-books` plugin and you have updated both `fiduswriter` and `fiduswriter-books` to the latest 3.9.x patch release.

2. Install this plugin (for example by running ``pip install fiduswriter-gitrepo-export``).

3. In your configuration.py file, add "gitrepo_export" and "allauth.socialaccount.providers.github" and/or "allauth.socialaccount.providers.gitlab" to ``INSTALLED_APPS``.

4a. Set up GitHub as one of the connected login options. See instructions here: https://django-allauth.readthedocs.io/en/latest/providers.html#github . The callback URL will be in the format https://DOMAIN.NAME/api/github/github/login/callback/

5a. In your configuration.py file, make sure to add repo rights for the github connector like this::

    SOCIALACCOUNT_PROVIDERS = {
        'github': {
            'SCOPE': [
                'repo',
                'user:email',
            ],
        }
    }

4b. Set up GitLab as one of the connected login options. See instructions here: https://django-allauth.readthedocs.io/en/latest/providers.html#gitlab . The callback URL will be in the format https://DOMAIN.NAME/api/gitlab/gitlab/login/callback/

5b. In your configuration.py file, make sure to add repo rights for the gitlab connector like this::

    SOCIALACCOUNT_PROVIDERS = {
        'gitlab': {
            'SCOPE': [
                'api',
            ],
        }
    }


To use:

1. Login to your Fidus Writer instance using GitHub/GitLab, or login with a regular account and connect a Gitlab/Github account on the profile page (https://DOMAIN.NAME/user/profile/)

2. Go to the books overview page.

3. Enter a book to set the gitrepo settings for the book.

4. Select the book in the overview and export to gitrepo via the dropdown menu.
