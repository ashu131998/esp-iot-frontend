package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoPickTest {
    private val app = "https://dashboard.floorbeat.in"

    @Test
    fun `Take photo opens the camera, Choose from phone the picker`() {
        assertEquals(Pick.CAMERA, PhotoPick.kind(captureEnabled = true, acceptTypes = listOf("image/*")))
        assertEquals(Pick.LIBRARY, PhotoPick.kind(captureEnabled = false, acceptTypes = listOf("image/*")))
        // a capture input for something that is not a picture: the picker
        assertEquals(Pick.LIBRARY, PhotoPick.kind(captureEnabled = true, acceptTypes = listOf("audio/*")))
        assertEquals(Pick.CAMERA, PhotoPick.kind(captureEnabled = true, acceptTypes = listOf("")))
    }

    @Test
    fun `the picker is asked for the input's type`() {
        assertEquals("image/*", PhotoPick.mimeType(listOf("image/*")))
        assertEquals("image/jpeg", PhotoPick.mimeType(listOf("image/jpeg,image/png")))
        assertEquals("*/*", PhotoPick.mimeType(listOf("")))
        assertEquals("*/*", PhotoPick.mimeType(emptyList()))
        assertTrue(PhotoPick.takesImages(listOf("image/jpeg, image/png")))
        assertFalse(PhotoPick.takesImages(listOf("video/*")))
    }

    @Test
    fun `only the app's own pages get the camera, and never the microphone`() {
        val both = listOf(PhotoPick.VIDEO_CAPTURE, "android.webkit.resource.AUDIO_CAPTURE")
        assertEquals(listOf(PhotoPick.VIDEO_CAPTURE), PhotoPick.cameraResources(both, "https://dashboard.floorbeat.in/", app))
        assertEquals(emptyList<String>(), PhotoPick.cameraResources(both, "https://example.com/", app))
        assertEquals(emptyList<String>(), PhotoPick.cameraResources(listOf("android.webkit.resource.AUDIO_CAPTURE"), "https://dashboard.floorbeat.in/", app))
        assertEquals(emptyList<String>(), PhotoPick.cameraResources(both, null, app))
    }
}
