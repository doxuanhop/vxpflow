use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

/// Reads a UTF-8 text file (project JSON import) selected via the native dialog.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Đọc tệp NHỊ PHÂN (ảnh png/jpg/bmp...) người dùng chọn trong dialog import assets.
#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

/// Writes raw bytes (exported .vxp / project zip) to a native-dialog path.
#[tauri::command]
fn vxp_write_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(&path, bytes).map_err(|e| e.to_string())
}

/// Tạo cây thư mục dự án (workspace kiểu game engine) nếu chưa tồn tại.
#[tauri::command]
fn ensure_project_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Ghi một tệp văn bản (project.json / src/main.lua / assets…) trong workspace —
/// tự tạo thư mục cha nếu chưa có.
#[tauri::command]
fn project_write_file(path: String, contents: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, contents).map_err(|e| e.to_string())
}

/// Ghi tệp nhị phân (.vxp / zip) vào thư mục build/ của workspace.
#[tauri::command]
fn project_write_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, bytes).map_err(|e| e.to_string())
}

/// Kết quả chạy pipeline MRE SDK (BuildApp.bat → TinyMRESDK PackRes/PackApp).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MreBuildResult {
    ok: bool,
    /// Toàn bộ log của BuildApp.bat (compile Lua core → link → pack .vxp).
    output: String,
    /// Kích thước LuaEngine.vxp vừa build (bytes).
    vxp_bytes: u64,
}

/// Đi lên từ một thư mục gốc tìm nơi có package.json + mre/LuaEngine/BuildApp.bat.
fn root_from(dir: std::path::PathBuf) -> Option<PathBuf> {
    let mut dir = dir;
    loop {
        if dir.join("package.json").is_file()
            && dir.join("mre").join("LuaEngine").join("BuildApp.bat").is_file()
        {
            return Some(dir);
        }
        if !dir.pop() {
            return None;
        }
    }
}

/// Tìm gốc dự án. Khi chạy `tauri dev`, cwd của tiến trình là `src-tauri/`
/// (trèo lên 1 cấp); khi launch trực tiếp exe thì dò theo đường dẫn binary.
/// Tìm MRE toolchain (luac + PackApp): ưu tiên BUNDLED theo exe (bản cài) → fallback D:\MRE.

/// Trả về gốc workspace ghi được cho frontend: %APPDATA%/VXPFlow/workspace (bản cài)
/// hoặc <gốc dự án>/workspace (dev). Tạo sẵn thư mục.
#[tauri::command]
fn workspace_root_cmd() -> Result<String, String> {
    let root = workspace_root().ok_or("Khong tim thay workspace root")?;
    let ws = root.join("workspace");
    std::fs::create_dir_all(&ws).map_err(|e| e.to_string())?;
    Ok(ws.to_string_lossy().to_string())
}

/// Trả về (luac, packapp).
fn resolve_mre_toolchain() -> (PathBuf, PathBuf) {
    // 1) Trong app: <exe_dir>\mre-tool\... hoặc resource dir của Tauri
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let luac = dir.join("mre-tool").join("luac").join("luac.exe");
            let pack = dir.join("mre-tool").join("packager").join("PackApp.exe");
            if luac.exists() && pack.exists() {
                return (luac, pack);
            }
        }
    }
    // 2) Dev: gốc dự án
    if let Some(root) = find_project_root() {
        let luac = root.join("mre-tool").join("luac").join("luac.exe");
        let pack = root.join("mre-tool").join("packager").join("PackApp.exe");
        if luac.exists() && pack.exists() {
            return (luac, pack);
        }
    }
    // 3) Fallback hệ thống D:\MRE (bản dev máy này)
    let mre_core = PathBuf::from(r"D:\MRE\lua-engine\mre-core");
    (mre_core.join("luac").join("luac.exe"), mre_core.join("packager").join("PackApp.exe"))
}


/// Môi trường cho tiến trình toolchain: thêm thư mục chứa exe vào PATH
/// (gcc im lặng fail khi không thấy as/ld; luac/PackApp cần DLL cùng thư mục).
fn tool_env(tool: &Path) -> std::collections::HashMap<String, String> {
    let mut env = std::env::vars().collect::<std::collections::HashMap<String, String>>();
    if let Some(dir) = tool.parent() {
        let dir_str = dir.to_string_lossy().to_string();
        let path = env.get("PATH").cloned().unwrap_or_default();
        if !path.to_lowercase().contains(&dir_str.to_lowercase()) {
            env.insert("PATH".into(), format!("{};{}", dir_str, path));
        }
    }
    // PATH cho cả bộ toolchain (gcc gọi as/ld từ bin)
    if let Some(tool_root) = tool.parent().and_then(|p| p.parent()) {
        for sub in ["luac", "packager", "gcc", "sdk"] {
            let d = if sub == "gcc" { tool_root.join("gcc").join("bin") } else { tool_root.join(sub) };
            if d.is_dir() {
                let ds = d.to_string_lossy().to_string();
                let path = env.get("PATH").cloned().unwrap_or_default();
                if !path.to_lowercase().contains(&ds.to_lowercase()) {
                    env.insert("PATH".into(), format!("{};{}", ds, path));
                }
            }
        }
    }
    env
}

/// Gốc làm việc của app: ưu tiên gốc DỰ ÁN (dev: package.json + mre/LuaEngine) —
/// ngược lại dùng thư mục chứa exe (bản cài .exe: workspace/ và mre-tool/ nằm cạnh exe).
fn app_root() -> Option<PathBuf> {
    if let Some(root) = find_project_root() {
        return Some(root);
    }
    std::env::current_exe().ok().and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
}

/// Gốc WORKSPACE ghi dữ liệu người dùng. Khi cài vào Program Files (perMachine),
/// ghi vào thư mục exe bị chặn → "Access is denied (os error 5)".
/// Bản cài: dùng %APPDATA%/VXPFlow/workspace (luôn ghi được, không cần admin).
/// Dev: dùng <gốc dự án>/workspace như cũ.
fn workspace_root() -> Option<PathBuf> {
    if find_project_root().is_some() {
        // môi trường dev — workspace theo gốc dự án
        return find_project_root();
    }
    // bản cài — thư mục dữ liệu người dùng
    if let Some(base) = std::env::var_os("APPDATA") {
        let dir = PathBuf::from(base).join("VXPFlow");
        let ws = dir.join("workspace");
        let _ = std::fs::create_dir_all(&ws);
        return Some(dir);
    }
    app_root()
}

fn find_project_root() -> Option<PathBuf> {
    root_from(std::env::current_dir().ok()?)
        .or_else(|| std::env::current_exe().ok().and_then(|exe| {
            exe.parent().map(|p| p.to_path_buf())
        }).and_then(root_from))
}

/// Chạy `BuildApp.bat` trong mre/LuaEngine (compile Lua 5.1 + link SDK +
/// đóng gói bằng TinyMRESDK). Bản thân bat đã đồng bộ kết quả ra
/// mre/dist/ và public/mre/ để studio đóng gói bản runtime mới nhất.
fn run_build(root: PathBuf) -> Result<MreBuildResult, String> {
    if !cfg!(windows) {
        return Err("Build LuaEngine.vxp chỉ hỗ trợ Windows (MRE SDK dùng cmd /C BuildApp.bat).".into());
    }

    let work = root.join("mre").join("LuaEngine");
    let vxp = work.join("arm").join("LuaEngine.vxp");

    let out = Command::new("cmd")
        .args(["/C", "BuildApp.bat"])
        .current_dir(&work)
        .output()
        .map_err(|e| format!("Không chạy được BuildApp.bat: {e}"))?;

    let mut output = String::from_utf8_lossy(&out.stdout).into_owned();
    if !out.stderr.is_empty() {
        output.push('\n');
        output.push_str(&String::from_utf8_lossy(&out.stderr));
    }

    let built_ok = out.status.success() && vxp.is_file();
    let size = vxp.metadata().map(|m| m.len()).unwrap_or(0);
    Ok(MreBuildResult {
        ok: built_ok,
        output,
        vxp_bytes: size,
    })
}

/// Build runtime MRE `LuaEngine.vxp` bằng pipeline thật (Lua C core → ARM
/// GCC → TinyMRESDK PackRes/PackApp). Chạy nền để không đứng giao diện.
#[tauri::command]
async fn build_vxp() -> Result<MreBuildResult, String> {
    let root = find_project_root().ok_or_else(|| {
        "Không tìm thấy gốc dự án (cần package.json + mre/LuaEngine/BuildApp.bat).".to_string()
    })?;
    tauri::async_runtime::spawn_blocking(move || run_build(root))
        .await
        .map_err(|e| e.to_string())?
}

/// Kết quả build project VXP
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectBuildResult {
    ok: bool,
    output: String,
    vxp_path: String,
    vxp_bytes: u64,
}

/// Build project VXP: luac → resource.bin (builder.py format) → PackApp → <slug>.vxp
///
/// App script (sinh từ Design + Blocks) được luac biên dịch thành bytecode
/// script.lub rồi NHÚNG thẳng vào .vxp qua resource.bin — đúng format
/// name-table + id-table mà MRE/PackApp::fix_res_offsets kỳ vọng (giống
/// gen_resource_bin của lua-engine — layout đã được chứng minh chạy trên MREmu).
///
/// AXF dùng làm runtime là TEMPLATE chuẩn `mre/dist/LuaEngineTemplate.axf`
/// (LuaEngine lua-engine — cùng toolchain mini-farm), KHÔNG build lại mỗi lần:
/// chỉ thay phần resource script. Kết quả ghi vào <build_dir>/<slug>.vxp.
#[tauri::command]
async fn build_project_vxp(
    lua_code: String,
    project_name: String,
    build_dir: String,
    app_id: u32,
    ram_kb: u32,
) -> Result<ProjectBuildResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if !cfg!(windows) {
            return Err("Build VXP chỉ hỗ trợ Windows.".into());
        }

        // build_dir có thể là đường dẫn TƯỜT ĐỐI (workspace) hoặc TƯƠNG ĐỐI (id project
        // không có storagePath — vd sample). Chuẩn hoá sang tuyệt đối: <app_root>/workspace/<id>/build
        // để luac.exe (chạy với current_dir = build_path) luôn mở được script.lua.
        // Dự án cũ có storagePath trỏ repo "vxpengine" (repo đã đổi tên) — chuyển sang repo hiện tại
        let build_dir = build_dir.replace(r"desktop-webapps\vxpengine", r"desktop-webapps\vxpflow")
            .replace("desktop-webapps/vxpengine", "desktop-webapps/vxpflow");
        let mut build_path = PathBuf::from(&build_dir);
        if !build_path.is_absolute() {
            let root = workspace_root()
                .ok_or("Không tìm thấy thư mục workspace (dev hoặc %APPDATA%/VXPFlow)")?;
            build_path = root.join("workspace").join(&build_dir);
        }
        // canonical hoá (resolve .., /) — luac không hiểu path có ".."
        let build_path = build_path
            .canonicalize()
            .unwrap_or(build_path);
        fs::create_dir_all(&build_path).map_err(|e| e.to_string())?;

        let root = app_root().ok_or("Không tìm thấy thư mục gốc của ứng dụng")?;
        // Toolchain MRE: ưu tiên BUNDLED theo exe (bản cài .exe) → mre-tool dự án → D:\MRE
        let (luac, packapp) = resolve_mre_toolchain();
        // AXF template chuẩn (runtime LuaEngine lua-engine) — chạy được trên MREmu
        let bundled_axf = std::env::current_exe().ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .map(|dir| dir.join("mre-tool").join("dist").join("LuaEngineTemplate.axf"));
        let axf_path = match bundled_axf {
            Some(p) if p.exists() => p,
            _ => root.join("mre").join("dist").join("LuaEngineTemplate.axf"),
        };

        if !luac.exists() {
            return Err(format!("Không tìm thấy luac.exe tại {}", luac.display()));
        }
        if !packapp.exists() {
            return Err(format!("Không tìm thấy PackApp.exe tại {}", packapp.display()));
        }
        if !axf_path.exists() {
            return Err(format!(
                "Không tìm thấy AXF template tại {} — cần mre/dist/LuaEngineTemplate.axf (runtime lua-engine)",
                axf_path.display()
            ));
        }

        let mut output = String::new();

        // 1) Ghi script.lua
        let script_path = build_path.join("script.lua");
        fs::write(&script_path, &lua_code).map_err(|e| e.to_string())?;
        output.push_str(&format!("[BUILD] script.lua {} bytes\n", lua_code.len()));

        // 2) luac → script.lub (bytecode Lua 5.1 cross-ARM)
        let lub_path = build_path.join("script.lub");
        let luac_out = Command::new(&luac)
            .args(["-s", "-o", lub_path.to_str().unwrap(), script_path.to_str().unwrap()])
            .current_dir(&build_path)
            .envs(tool_env(&luac))
            .output()
            .map_err(|e| format!("Không chạy được luac.exe: {e}"))?;

        let luac_log = String::from_utf8_lossy(&luac_out.stdout).to_string();
        let luac_err = String::from_utf8_lossy(&luac_out.stderr).to_string();
        if !luac_log.is_empty() { output.push_str(&luac_log); }
        if !luac_err.is_empty() { output.push_str(&luac_err); }
        if !luac_out.status.success() || !lub_path.exists() {
            return Err(format!("luac thất bại:\n{}", output));
        }
        let lub_bytes = fs::read(&lub_path).map_err(|e| e.to_string())?;
        output.push_str(&format!("[OK] script.lub {} bytes\n", lub_bytes.len()));

        // 3) resource.bin — builder.py format (đã chạy được trên MREmu):
        //    name\0 offset size ... \0 ptr id_table: (id,off)... (0xFFFFFFFF,0) blobs...
        //    offset là TUYỆT ĐỐI tính từ byte ĐẦU resource.bin (PackApp sẽ +res_offset).
        //    Tên resource PHẢI là "main.lub" — runtime template (lua-engine LuaEngine)
        //    nạp vm_load_resource("main.lub") khi khởi động.
        let lub_name = b"main.lub";
        let name_tbl = lub_name.len() + 1 + 8 + 1 + 4; // name\0 + off + size + \0 + ptr
        let id_tbl = 8 * 2; // (id=1,off) + (0xFFFFFFFF, 0)
        let blob_off = (name_tbl + id_tbl) as i32;

        let mut res: Vec<u8> = Vec::with_capacity(name_tbl + id_tbl + lub_bytes.len());
        res.extend_from_slice(lub_name);
        res.push(0);
        res.extend_from_slice(&blob_off.to_le_bytes());
        res.extend_from_slice(&(lub_bytes.len() as i32).to_le_bytes());
        res.push(0);                          // end name table
        res.extend_from_slice(&(name_tbl as i32).to_le_bytes()); // id_table_pos + 4 → trỏ vào id table
        res.extend_from_slice(&1i32.to_le_bytes());              // resource id 1
        res.extend_from_slice(&blob_off.to_le_bytes());          // offset blob
        res.extend_from_slice(&0xFFFFFFFFu32.to_le_bytes());     // terminator id
        res.extend_from_slice(&0i32.to_le_bytes());              // terminator off
        res.extend_from_slice(&lub_bytes);

        let res_path = build_path.join("resource.bin");
        fs::write(&res_path, &res).map_err(|e| e.to_string())?;
        output.push_str(&format!("[OK] resource.bin {} bytes (nhúng main.lub)\n", res.len()));

        // 4) PackApp → <slug>.vxp (axf template + resource nhúng)
        let safe_name = project_name.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
            .collect::<String>();
        let vxp_path = build_path.join(format!("{}.vxp", safe_name));

        let pack_args: Vec<String> = vec![
            "-a".into(), axf_path.to_str().unwrap().to_string(),
            "-r".into(), res_path.to_str().unwrap().to_string(),
            "-o".into(), vxp_path.to_str().unwrap().to_string(),
            "-tr".into(), ram_kb.to_string(),
            "-tn".into(), project_name.clone(),
            "-tdn".into(), "VXPEngine - Drag & Drop".into(),
            "-tb".into(), "0".into(),
            "-tapi".into(), "File Audio".into(),
            "-ty".into(), "vxp".into(),
            "-tc".into(), "GCC".into(),
            "-tai".into(), app_id.to_string(),
        ];

        let pack_out = Command::new(&packapp)
            .args(&pack_args)
            .current_dir(&build_path)
            .envs(tool_env(&packapp))
            .output()
            .map_err(|e| format!("Không chạy được PackApp.exe: {e}"))?;

        let pack_log = String::from_utf8_lossy(&pack_out.stdout).to_string();
        let pack_err = String::from_utf8_lossy(&pack_out.stderr).to_string();
        if !pack_log.is_empty() { output.push_str(&pack_log); }
        if !pack_err.is_empty() { output.push_str(&pack_err); }
        if !pack_out.status.success() || !vxp_path.exists() {
            return Err(format!("PackApp thất bại:\n{}", output));
        }

        let vxp_size = fs::metadata(&vxp_path).map(|m| m.len()).unwrap_or(0);
        output.push_str(&format!(
            "[OK] {}.vxp {} bytes — appid={} ram={}KB (script NHÚNG, chạy được trên MREmu)\n",
            safe_name, vxp_size, app_id, ram_kb
        ));

        Ok(ProjectBuildResult {
            ok: true,
            output,
            vxp_path: vxp_path.to_string_lossy().to_string(),
            vxp_bytes: vxp_size,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Cấu trúc workspace chuẩn của một dự án VXPEngine:
/// <root>/<ten_project>/
///   assets/          ảnh & tài nguyên đồ họa (240x320 / 320x240…)
///   config/          mre.inf, app.cfg, project.json
///   extensions/      tiện ích .mvxp người dùng cài thêm
///   src/             mã nguồn Lua (main.lua / script.lua sinh từ Blocks)
///   build/           xuất bản .vxp
fn workspace_subdirs() -> Vec<&'static str> {
    vec!["assets", "config", "extensions", "src", "build"]
}

/// Tạo cấu trúc workspace cho dự án tại <root>/<ten_project>/ (tự tạo root nếu thiếu).
/// Trả về đường dẫn thư mục dự án đã tạo.
#[tauri::command]
fn workspace_ensure(root: String, project_name: String) -> Result<String, String> {
    let slug = project_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect::<String>();
    let dir = PathBuf::from(root.replace('\\', "/").trim_end_matches('/').to_string())
        .join(&slug);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    for sub in workspace_subdirs() {
        fs::create_dir_all(dir.join(sub)).map_err(|e| e.to_string())?;
    }
    Ok(dir.to_string_lossy().to_string())
}

/// Liệt kê cây thư mục workspace (2 cấp) — trả về JSON đơn giản name/children.
#[tauri::command]
fn workspace_list(dir: String) -> Result<String, String> {
    fn walk(p: &std::path::Path, depth: usize) -> serde_json::Value {
        let mut children: Vec<serde_json::Value> = Vec::new();
        if depth < 2 {
            if let Ok(rd) = fs::read_dir(p) {
                let mut entries: Vec<_> = rd.filter_map(|e| e.ok()).collect();
                entries.sort_by_key(|e| e.file_name());
                for e in entries {
                    let path = e.path();
                    let is_dir = path.is_dir();
                    let size = if is_dir { 0 } else { fs::metadata(&path).map(|m| m.len()).unwrap_or(0) };
                    children.push(serde_json::json!({
                        "name": e.file_name().to_string_lossy(),
                        "dir": is_dir,
                        "size": size,
                        "children": if is_dir { walk(&path, depth + 1) } else { serde_json::Value::Null }
                    }));
                }
            }
        }
        serde_json::Value::Array(children)
    }
    let root = std::path::Path::new(&dir);
    if !root.exists() {
        return Err(format!("Thư mục không tồn tại: {}", dir));
    }
    serde_json::to_string(&walk(root, 0)).map_err(|e| e.to_string())
}

/// Ghi tệp nhị phân vào workspace (ảnh import, asset…)
#[tauri::command]
fn workspace_write_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, bytes).map_err(|e| e.to_string())
}

/// Mở thư mục workspace trong Windows Explorer (chọn thư mục).
#[tauri::command]
fn workspace_open(dir: String) -> Result<(), String> {
    Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            read_binary_file,
            vxp_write_bytes,
            ensure_project_dir,
            project_write_file,
            project_write_bytes,
            workspace_root_cmd,
            workspace_ensure,
            workspace_list,
            workspace_write_bytes,
            workspace_open,
            build_vxp,
            build_project_vxp
        ])
        .run(tauri::generate_context!())
        .expect("error while running VXPEngine - Drag & Drop");
}
