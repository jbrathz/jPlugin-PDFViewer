<?php
/**
 * Plugin Name: jPlugin-PDFViewer
 * Plugin URI: https://dev.jirath.com/
 * Description: แปลง PDF embed ของ WordPress ให้ใช้ PDF.js แทน เพื่อแก้ปัญหา X-Frame-Options บน Chrome/Edge
 * Version: 1.0.0
 * Author: JIRATH BURAPARATH
 * Author URI: https://www.jirath.com
 * Text Domain: jpdfviewer
 * License: GPL v2 or later
 */

// ป้องกันการเข้าถึงไฟล์โดยตรง
if (!defined('ABSPATH')) {
    exit;
}

// กำหนดค่าคงที่
define('JPDF_VERSION', '1.0.0');
define('JPDF_PLUGIN_FILE', __FILE__);
define('JPDF_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('JPDF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('JPDF_PLUGIN_BASENAME', plugin_basename(__FILE__));

// เริ่มต้นปลั๊กอิน
function jpdfviewer_init() {
    add_action('wp_enqueue_scripts', 'jpdfviewer_enqueue_scripts');
}
add_action('init', 'jpdfviewer_init');

/**
 * Enqueue PDF.js และ viewer script
 */
function jpdfviewer_enqueue_scripts() {
    if (is_admin()) {
        return;
    }

    // Viewer CSS
    wp_enqueue_style(
        'jpdf-viewer-style',
        JPDF_PLUGIN_URL . 'assets/css/viewer.css',
        [],
        JPDF_VERSION
    );

    // โหลด viewer script ผ่าน wp_footer เพื่อใช้ type="module" กับ ES Module ของ PDF.js
    add_action('wp_footer', 'jpdfviewer_render_script', 20);
}

/**
 * Render script tag ใน footer (ใช้ type="module" สำหรับ PDF.js ES Module)
 */
function jpdfviewer_render_script() {
    $pdfjs_url  = esc_url(JPDF_PLUGIN_URL . 'assets/js/pdf.min.mjs');
    $worker_url = esc_url(JPDF_PLUGIN_URL . 'assets/js/pdf.worker.min.mjs');
    $viewer_url = esc_url(JPDF_PLUGIN_URL . 'assets/js/viewer.mjs');
    ?>
    <script type="module">
        import * as pdfjsLib from '<?php echo $pdfjs_url; ?>';
        pdfjsLib.GlobalWorkerOptions.workerSrc = '<?php echo $worker_url; ?>';
        window._jpdfLib = pdfjsLib;
    </script>
    <script defer src="<?php echo esc_url($viewer_url); ?>?v=<?php echo esc_attr(JPDF_VERSION); ?>"></script>
    <?php
}
