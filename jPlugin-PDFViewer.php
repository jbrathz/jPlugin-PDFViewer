<?php
/**
 * Plugin Name: jPlugin-PDFViewer
 * Plugin URI: https://dev.jirath.com/
 * Description: แปลง PDF embed ของ WordPress ให้ใช้ PDF.js แทน เพื่อแก้ปัญหา X-Frame-Options บน Chrome/Edge
 * Version: 1.0.1
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
define('JPDF_VERSION', '1.0.1');
define('JPDF_PLUGIN_FILE', __FILE__);
define('JPDF_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('JPDF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('JPDF_PLUGIN_BASENAME', plugin_basename(__FILE__));

// เริ่มต้นปลั๊กอิน
function jpdfviewer_init() {
    add_action('wp_enqueue_scripts', 'jpdfviewer_enqueue_frontend_assets');
    add_action('admin_enqueue_scripts', 'jpdfviewer_enqueue_admin_assets');
    add_action('enqueue_block_assets', 'jpdfviewer_enqueue_block_editor_assets');
}
add_action('init', 'jpdfviewer_init');

/**
 * Enqueue assets บน frontend
 */
function jpdfviewer_enqueue_frontend_assets() {
    jpdfviewer_enqueue_assets();
}

/**
 * Enqueue assets บน admin edit page (post/page)
 */
function jpdfviewer_enqueue_admin_assets($hook_suffix) {
    if (!in_array($hook_suffix, ['post.php', 'post-new.php'], true)) {
        return;
    }

    jpdfviewer_enqueue_assets();
}

/**
 * Enqueue assets ใน block editor iframe
 */
function jpdfviewer_enqueue_block_editor_assets() {
    if (!is_admin()) {
        return;
    }

    jpdfviewer_enqueue_assets();
}

/**
 * Enqueue PDF.js viewer assets
 */
function jpdfviewer_enqueue_assets() {
    static $is_enqueued = false;
    if ($is_enqueued) {
        return;
    }
    $is_enqueued = true;

    // Viewer CSS
    wp_enqueue_style(
        'jpdf-viewer-style',
        JPDF_PLUGIN_URL . 'assets/css/viewer.css',
        [],
        JPDF_VERSION
    );

    // โหลด viewer script เป็นไฟล์เดียว และให้ JS import PDF.js เองผ่าน jpdfViewerConfig
    wp_enqueue_script(
        'jpdf-viewer-script',
        JPDF_PLUGIN_URL . 'assets/js/viewer.mjs',
        [],
        JPDF_VERSION,
        true
    );

    $config = [
        'pdfjsUrl'  => esc_url_raw(JPDF_PLUGIN_URL . 'assets/js/pdf.min.mjs'),
        'workerUrl' => esc_url_raw(JPDF_PLUGIN_URL . 'assets/js/pdf.worker.min.mjs'),
        'siteOrigin' => esc_url_raw(home_url('/')),
        'allowExternalPdf' => false,
    ];

    wp_add_inline_script(
        'jpdf-viewer-script',
        '(function(){' .
            'var config = ' . wp_json_encode($config) . ';' .
            'try {' .
                'Object.defineProperty(window, "__JPDF_VIEWER_CONFIG__", {' .
                    'value: Object.freeze(config),' .
                    'writable: false,' .
                    'configurable: false' .
                '});' .
            '} catch (e) {' .
                'window.__JPDF_VIEWER_CONFIG__ = config;' .
            '}' .
        '})();',
        'before'
    );
}
