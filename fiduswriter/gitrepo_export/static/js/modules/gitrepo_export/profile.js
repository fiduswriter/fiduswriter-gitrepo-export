import {ForgejoServerManagerDialog} from "./forgejo_management"

export class GitrepoExporterProfile {
    constructor(profile) {
        this.profile = profile
    }

    init() {
        this.profile.pluginTemplates.push(
            `<div class="profile-data-row">
                <label class="form-label">${gettext("Git Repository Servers")}</label>
                <div class="profile-gitrepo-settings">
                    <p class="inline-editor-hint">${gettext("Manage Forgejo servers for exporting documents to Git repositories.")}</p>
                    <span id="manage-forgejo-servers" class="fw-button fw-light fw-small">
                        <i class="fa fa-cog"></i> ${gettext("Manage Forgejo Servers")}
                    </span>
                </div>
            </div>`
        )
        this.profile.clickTargets["#manage-forgejo-servers"] = (
            _el,
            _event
        ) => {
            this.manageForgejoServers()
        }
    }

    manageForgejoServers() {
        const manager = new ForgejoServerManagerDialog()
        manager.open()
    }
}
