package jp.efk.camera

import jp.efk.camera.camera.PreviewHub

/**
 * 本体画面がサービス側のプレビューを参照するための最小限の受け渡し口。
 *
 * バインドサービスにすると、画面の開閉でサービスのライフサイクルに影響が出うるため、
 * 参照を1つだけ置く形にしている（録画中のカメラに触れないことを優先）。
 */
object EfkServiceLocator {

    @Volatile
    var previewHub: PreviewHub? = null
}
