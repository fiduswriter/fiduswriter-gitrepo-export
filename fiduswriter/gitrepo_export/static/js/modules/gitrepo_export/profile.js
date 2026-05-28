import {GitServerManagerDialog} from "./git_server_management"

export class GitrepoExporterProfile {
    constructor(profile) {
        this.profile = profile
    }

    init() {
        this.profile.pluginTemplates.push(
            `<div class="profile-data-row">
                <label class="form-label">${gettext("Git Repository Servers")}</label>
                <div class="profile-gitrepo-settings">
                    <p class="inline-editor-hint">${gettext("Manage git servers (GitHub, GitLab, Forgejo, Gitea) for exporting documents to Git repositories.")}</p>
                    <span id="manage-git-servers" class="fw-button fw-light fw-small">
                        <i class="fa fa-cog"></i> ${gettext("Manage Git Servers")}
                    </span>
                </div>
            </div>`
        )
        this.profile.clickTargets["#manage-git-servers"] = (_el, _event) => {
            this.manageGitServers()
        }
    }

    manageGitServers() {
        const manager = new GitServerManagerDialog()
        manager.open()
    }
}
