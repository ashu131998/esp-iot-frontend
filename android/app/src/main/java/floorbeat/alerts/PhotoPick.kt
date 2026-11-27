package floorbeat.alerts

/** What a photo field's button asks for: the camera app (a photo taken now) or the phone's photos and files. */
enum class Pick { CAMERA, LIBRARY }

/**
 * The page's file inputs and camera requests, as the app answers them. Pure: PhotoPickTest.
 *
 * The stock's page (src/components/ims-app/field-photo.tsx) has two inputs for a photo field: "Take photo"
 * (an image input with `capture="environment"`) and "Choose from phone" (an image input). The web view
 * hands both to the app; which one it was is told by `capture`.
 */
object PhotoPick {
    /** The camera for an input that asks for it and takes pictures; anything else picks a file. */
    fun kind(captureEnabled: Boolean, acceptTypes: List<String>): Pick =
        if (captureEnabled && takesImages(acceptTypes)) Pick.CAMERA else Pick.LIBRARY

    /** Whether an input takes pictures: any image type, any file, or no type given at all. */
    fun takesImages(acceptTypes: List<String>): Boolean {
        val types = acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase() }.filter { it.isNotEmpty() }
        return types.isEmpty() || types.any { it.startsWith("image/") || it == "*/*" }
    }

    /** The type the phone's picker is asked for: the input's first, else any file. */
    fun mimeType(acceptTypes: List<String>): String {
        val first = acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase() }.firstOrNull { it.contains('/') }
        return first ?: "*/*"
    }

    /**
     * A page asking for the camera (getUserMedia: a QR scanner, should one come back): granted only to the app's own pages and
     * only the camera (`android.webkit.resource.VIDEO_CAPTURE`); never the microphone or anything else.
     */
    fun cameraResources(resources: List<String>, pageOrigin: String?, appUrl: String): List<String> {
        if (!AppUrls.isAppPage(pageOrigin, appUrl)) return emptyList()
        return resources.filter { it == VIDEO_CAPTURE }
    }

    const val VIDEO_CAPTURE = "android.webkit.resource.VIDEO_CAPTURE"
}
