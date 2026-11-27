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

// One app: FloorBeat (app/), its alerts, dashboard and stock, since 3.0.0 (it was FloorBeat Alerts, beside a dashboard
// app of its own until 2026-11-27). README.md.
rootProject.name = "FloorBeat"
include(":app")
