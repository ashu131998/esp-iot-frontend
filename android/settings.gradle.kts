pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

// Three apps: FloorBeat Alerts (app/), FloorBeat, the dashboard (dashboard/), and FloorBeat IMS, the stock app (ims/). README.md.
rootProject.name = "FloorBeat Alerts"
include(":app")
include(":dashboard")
include(":ims")
