use std::collections::{HashMap, HashSet};
use std::io::Cursor;

use axum::extract::{Multipart, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use calamine::Reader;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::Session;
use crate::error::{AppError, AppResult};
use crate::rbac::{authorize, AuthorizeOptions};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/import/upload", post(upload))
        .route("/api/admin/import/validate", post(validate))
        .route("/api/admin/import/commit", post(commit))
        .route("/api/admin/import/jobs", get(list_jobs))
}

pub type ParsedRow = HashMap<String, String>;

#[derive(Clone)]
pub struct ImportJob {
    pub file_name: String,
    pub rows: Vec<ParsedRow>,
}

struct CanonicalField {
    key: &'static str,
    label: &'static str,
    required: bool,
    aliases: &'static [&'static str],
}

const CANONICAL_STUDENT_FIELDS: &[CanonicalField] = &[
    CanonicalField { key: "studentId", label: "Student ID", required: true, aliases: &["stu_id", "student_id", "stuid", "id", "roll_no", "rollno", "sid", "enrollment_no"] },
    CanonicalField { key: "fullName", label: "Full Name", required: true, aliases: &["stud_name", "full_name", "name", "student_name", "studname"] },
    CanonicalField { key: "dob", label: "Date of Birth", required: false, aliases: &["dob", "date_of_birth", "birth_date", "dateofbirth"] },
    CanonicalField { key: "gender", label: "Gender", required: false, aliases: &["gender", "sex"] },
    CanonicalField { key: "department", label: "Department", required: false, aliases: &["dept", "dept_cd", "department", "branch_cd", "branch"] },
    CanonicalField { key: "programme", label: "Programme", required: true, aliases: &["course_nm", "course", "programme", "program", "prog_name"] },
    CanonicalField { key: "semester", label: "Semester", required: false, aliases: &["sem", "semester", "current_sem"] },
    CanonicalField { key: "phone", label: "Phone", required: false, aliases: &["mobile_no", "mobile", "phone", "contact_no", "phone_no", "cell"] },
    CanonicalField { key: "email", label: "Email", required: false, aliases: &["mail", "email", "email_id", "emailaddress", "e_mail"] },
];

fn normalize(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}

fn similarity(a: &str, b: &str) -> f64 {
    let na = normalize(a);
    let nb = normalize(b);
    if na.is_empty() || nb.is_empty() {
        return 0.0;
    }
    if na == nb {
        return 1.0;
    }
    if na.contains(&nb) || nb.contains(&na) {
        return 0.85 + 0.1 * (na.len().min(nb.len()) as f64 / na.len().max(nb.len()) as f64);
    }

    let ta: HashSet<String> = a.to_lowercase().split(|c: char| !c.is_ascii_alphanumeric()).filter(|s| !s.is_empty()).map(String::from).collect();
    let tb: HashSet<String> = b.to_lowercase().split(|c: char| !c.is_ascii_alphanumeric()).filter(|s| !s.is_empty()).map(String::from).collect();
    let shared = ta.intersection(&tb).count();
    let union = ta.union(&tb).count();
    if union == 0 { 0.0 } else { 0.55 * shared as f64 / union as f64 }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FieldSuggestion {
    column: String,
    canonical_key: Option<String>,
    canonical_label: Option<String>,
    confidence: f64,
}

fn infer_mapping(columns: &[String]) -> Vec<FieldSuggestion> {
    let mut best_per_column: HashMap<&str, (&CanonicalField, f64)> = HashMap::new();
    for column in columns {
        let mut best: Option<(&CanonicalField, f64)> = None;
        for field in CANONICAL_STUDENT_FIELDS {
            let mut score = similarity(column, field.key);
            for alias in field.aliases {
                score = score.max(similarity(column, alias));
            }
            if score > 0.4 && best.map(|(_, s)| score > s).unwrap_or(true) {
                best = Some((field, score));
            }
        }
        if let Some(b) = best {
            best_per_column.insert(column.as_str(), b);
        }
    }

    // Greedy unique assignment: highest-confidence column wins each canonical field.
    let mut claimed: HashMap<&str, (&str, f64)> = HashMap::new();
    for (column, (field, score)) in &best_per_column {
        let entry = claimed.entry(field.key);
        match entry {
            std::collections::hash_map::Entry::Occupied(mut o) => {
                if *score > o.get().1 {
                    o.insert((column, *score));
                }
            }
            std::collections::hash_map::Entry::Vacant(v) => {
                v.insert((column, *score));
            }
        }
    }

    columns
        .iter()
        .map(|column| {
            let matched = claimed.iter().find(|(_, (c, _))| c == column);
            match matched {
                Some((key, (_, score))) => {
                    let field = CANONICAL_STUDENT_FIELDS.iter().find(|f| &f.key == key).unwrap();
                    FieldSuggestion {
                        column: column.clone(),
                        canonical_key: Some(field.key.to_string()),
                        canonical_label: Some(field.label.to_string()),
                        confidence: (score * 100.0).round() / 100.0,
                    }
                }
                None => FieldSuggestion { column: column.clone(), canonical_key: None, canonical_label: None, confidence: 0.0 },
            }
        })
        .collect()
}

fn parse_csv(bytes: &[u8]) -> AppResult<(Vec<String>, Vec<ParsedRow>)> {
    let mut reader = csv::Reader::from_reader(bytes);
    let headers: Vec<String> = reader.headers().map_err(|e| AppError::BadRequest(e.to_string()))?.iter().map(String::from).collect();
    let mut rows = vec![];
    for record in reader.records() {
        let record = record.map_err(|e| AppError::BadRequest(e.to_string()))?;
        let row: ParsedRow = headers.iter().cloned().zip(record.iter().map(String::from)).collect();
        rows.push(row);
    }
    Ok((headers, rows))
}

fn parse_json(bytes: &[u8]) -> AppResult<(Vec<String>, Vec<ParsedRow>)> {
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| AppError::BadRequest(e.to_string()))?;
    let arr = value.as_array().ok_or_else(|| AppError::BadRequest("Expected a JSON array of records.".to_string()))?;
    let mut columns: Vec<String> = vec![];
    let mut seen = HashSet::new();
    let mut rows = vec![];
    for item in arr {
        let obj = item.as_object().ok_or_else(|| AppError::BadRequest("Each JSON record must be an object.".to_string()))?;
        let mut row = ParsedRow::new();
        for (k, v) in obj {
            if seen.insert(k.clone()) {
                columns.push(k.clone());
            }
            let text = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Null => String::new(),
                other => other.to_string(),
            };
            row.insert(k.clone(), text);
        }
        rows.push(row);
    }
    Ok((columns, rows))
}

fn parse_xlsx(bytes: &[u8]) -> AppResult<(Vec<String>, Vec<ParsedRow>)> {
    let cursor = Cursor::new(bytes);
    let mut workbook: calamine::Xlsx<_> = calamine::open_workbook_from_rs(cursor).map_err(|e: calamine::XlsxError| AppError::BadRequest(e.to_string()))?;
    let sheet_name = workbook.sheet_names().first().cloned().ok_or_else(|| AppError::BadRequest("Workbook has no sheets.".to_string()))?;
    let range = workbook.worksheet_range(&sheet_name).map_err(|e| AppError::BadRequest(e.to_string()))?;

    let mut rows_iter = range.rows();
    let header_row = rows_iter.next().ok_or_else(|| AppError::BadRequest("Sheet is empty.".to_string()))?;
    let columns: Vec<String> = header_row.iter().map(|c| c.to_string()).collect();

    let mut rows = vec![];
    for r in rows_iter {
        let row: ParsedRow = columns.iter().cloned().zip(r.iter().map(|c| c.to_string())).collect();
        rows.push(row);
    }
    Ok((columns, rows))
}

fn parse_file(file_name: &str, bytes: &[u8]) -> AppResult<(&'static str, Vec<String>, Vec<ParsedRow>)> {
    let ext = file_name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "csv" => { let (c, r) = parse_csv(bytes)?; Ok(("csv", c, r)) }
        "json" => { let (c, r) = parse_json(bytes)?; Ok(("json", c, r)) }
        "xlsx" | "xls" => { let (c, r) = parse_xlsx(bytes)?; Ok(("xlsx", c, r)) }
        _ => Err(AppError::BadRequest("Unsupported file type - use CSV, XLSX or JSON.".to_string())),
    }
}

async fn upload(State(state): State<AppState>, Session(ctx): Session, mut multipart: Multipart) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "data.import", None, AuthorizeOptions::default()).await?;

    let mut file_name = String::new();
    let mut bytes = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        if field.name() == Some("file") {
            file_name = field.file_name().unwrap_or("upload").to_string();
            bytes = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?.to_vec();
        }
    }
    if bytes.is_empty() {
        return Err(AppError::BadRequest("No file provided".to_string()));
    }

    let (format, columns, rows) = parse_file(&file_name, &bytes)?;
    let mapping = infer_mapping(&columns);
    let row_count = rows.len();
    let sample_rows: Vec<_> = rows.iter().take(8).cloned().collect();

    let job_id = format!("job-{:x}-{:x}", chrono::Utc::now().timestamp_millis(), rand::random::<u32>());
    let job = ImportJob { file_name: file_name.clone(), rows };
    state.import_jobs.lock().unwrap().insert(job_id.clone(), job);

    let mapping_json = serde_json::to_string(&mapping).unwrap();
    sqlx::query!(
        r#"insert into import_jobs (file_name, source_format, target_entity, status, column_mapping, row_count, imported_count)
           values ($1, $2, 'students', 'mapped', $3, $4, 0)"#,
        file_name,
        format,
        mapping_json,
        row_count as i32
    )
    .execute(&state.pool)
    .await?;

    let fields: Vec<_> = CANONICAL_STUDENT_FIELDS.iter().map(|f| json!({ "key": f.key, "label": f.label, "required": f.required })).collect();

    Ok(Json(json!({
        "jobId": job_id, "fileName": file_name, "columns": columns, "rowCount": row_count,
        "mapping": mapping, "sampleRows": sample_rows, "fields": fields,
    })))
}

struct ProgrammeOption {
    id: i32,
    department_id: i32,
    keywords: Vec<String>,
}

async fn programme_index(pool: &sqlx::PgPool) -> AppResult<Vec<ProgrammeOption>> {
    let rows = sqlx::query!(
        r#"select p.id, p.department_id, p.name, p.code, d.code as dept_code
           from programmes p join departments d on d.id = p.department_id"#
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| ProgrammeOption {
            id: r.id,
            department_id: r.department_id,
            keywords: vec![r.name.to_lowercase(), r.code.to_lowercase(), r.dept_code.to_lowercase()],
        })
        .collect())
}

fn resolve_programme<'a>(index: &'a [ProgrammeOption], raw: &str) -> Option<&'a ProgrammeOption> {
    let text = raw.to_lowercase();
    if let Some(p) = index.iter().find(|p| p.keywords.iter().any(|k| k.len() > 1 && text.contains(k.as_str()))) {
        return Some(p);
    }
    const WORD_HINTS: &[(&str, &str)] =
        &[("computer", "cse"), ("mechanical", "me"), ("electronic", "ece"), ("civil", "ce"), ("business", "mgmt"), ("management", "mgmt"), ("mba", "mgmt")];
    for (word, dept_code) in WORD_HINTS {
        if text.contains(word) {
            if let Some(p) = index.iter().find(|p| p.keywords.iter().any(|k| k == dept_code)) {
                return Some(p);
            }
        }
    }
    None
}

fn map_row(row: &ParsedRow, mapping: &[FieldSuggestion]) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for m in mapping {
        if let Some(key) = &m.canonical_key {
            out.insert(key.clone(), row.get(&m.column).cloned().unwrap_or_default());
        }
    }
    out
}

#[derive(Debug, Deserialize)]
struct JobBody {
    #[serde(rename = "jobId")]
    job_id: String,
    mapping: Vec<FieldSuggestion>,
}

async fn validate(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<JobBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "data.import", None, AuthorizeOptions::default()).await?;

    let job = state.import_jobs.lock().unwrap().get(&body.job_id).cloned().ok_or_else(|| AppError::BadRequest("Import job not found or expired - re-upload the file.".to_string()))?;
    let index = programme_index(&state.pool).await?;
    let existing_rolls: HashSet<String> = sqlx::query!("select roll_number from students").fetch_all(&state.pool).await?.into_iter().map(|r| r.roll_number).collect();

    let mut issues = vec![];
    let mut valid_rows = 0;
    let mut new_count = 0;
    let mut reconciled_count = 0;

    for (idx, row) in job.rows.iter().enumerate() {
        let mapped = map_row(row, &body.mapping);
        let student_id = mapped.get("studentId").cloned().unwrap_or_default();
        let full_name = mapped.get("fullName").cloned().unwrap_or_default();
        let programme = mapped.get("programme").cloned().unwrap_or_default();

        if student_id.is_empty() {
            issues.push(json!({ "rowIndex": idx, "message": "Missing Student ID" }));
            continue;
        }
        if full_name.is_empty() {
            issues.push(json!({ "rowIndex": idx, "message": "Missing Full Name" }));
            continue;
        }
        if programme.is_empty() || resolve_programme(&index, &programme).is_none() {
            issues.push(json!({ "rowIndex": idx, "message": format!("Unrecognized programme \"{programme}\"") }));
            continue;
        }
        valid_rows += 1;
        if existing_rolls.contains(&student_id) { reconciled_count += 1 } else { new_count += 1 }
    }

    Ok(Json(json!({
        "totalRows": job.rows.len(),
        "validRows": valid_rows,
        "issueRows": issues.len(),
        "issues": issues.iter().take(25).collect::<Vec<_>>(),
        "entityCounts": [
            { "label": "New students", "count": new_count },
            { "label": "Existing students reconciled", "count": reconciled_count },
        ],
    })))
}

async fn commit(State(state): State<AppState>, Session(ctx): Session, Json(body): Json<JobBody>) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "data.import", None, AuthorizeOptions::default()).await?;

    let job = state.import_jobs.lock().unwrap().get(&body.job_id).cloned().ok_or_else(|| AppError::BadRequest("Import job not found or expired - re-upload the file.".to_string()))?;
    let index = programme_index(&state.pool).await?;
    let university_id = sqlx::query!("select id from universities limit 1").fetch_optional(&state.pool).await?.ok_or_else(|| AppError::BadRequest("No university seeded.".to_string()))?.id;

    let now = chrono::Utc::now();
    let mut imported = 0;
    let mut reconciled = 0;
    let mut skipped = 0;

    for row in &job.rows {
        let mapped = map_row(row, &body.mapping);
        let student_id = mapped.get("studentId").cloned().unwrap_or_default();
        let full_name = mapped.get("fullName").cloned().unwrap_or_default();
        let programme_raw = mapped.get("programme").cloned().unwrap_or_default();
        let programme = if programme_raw.is_empty() { None } else { resolve_programme(&index, &programme_raw) };

        if student_id.is_empty() || full_name.is_empty() || programme.is_none() {
            skipped += 1;
            continue;
        }
        let programme = programme.unwrap();

        let mut parts = full_name.split_whitespace();
        let first_name = parts.next().unwrap_or("Unknown").to_string();
        let last_name = { let rest: Vec<&str> = parts.collect(); if rest.is_empty() { first_name.clone() } else { rest.join(" ") } };

        let existing = sqlx::query!("select id from students where roll_number = $1", student_id).fetch_optional(&state.pool).await?;

        if let Some(existing) = existing {
            sqlx::query!(
                "update students set source_system = 'legacy-import', source_table = $1, source_id = $2, last_synced_at = $3, updated_at = now() where id = $4",
                job.file_name,
                student_id,
                now.to_rfc3339(),
                existing.id
            )
            .execute(&state.pool)
            .await?;
            reconciled += 1;
        } else {
            let email = mapped.get("email").filter(|s| !s.is_empty()).cloned().unwrap_or_else(|| format!("{student_id}@legacy.cit.edu.in"));
            let phone = mapped.get("phone").filter(|s| !s.is_empty()).cloned().unwrap_or_else(|| "9000000000".to_string());
            let dob = mapped.get("dob").filter(|s| !s.is_empty()).cloned().unwrap_or_else(|| "2005-01-01".to_string());
            let gender = mapped.get("gender").filter(|s| !s.is_empty()).cloned().unwrap_or_else(|| "unspecified".to_string());
            let semester: i32 = mapped.get("semester").and_then(|s| s.parse().ok()).filter(|&s| (1..=8).contains(&s)).unwrap_or(1);

            sqlx::query!(
                r#"insert into students (university_id, department_id, programme_id, roll_number, first_name, last_name, email, phone, dob, gender,
                                          admission_year, current_semester, status, source_system, source_table, source_id, last_synced_at)
                   values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', 'legacy-import', $13, $4, $14)"#,
                university_id,
                programme.department_id,
                programme.id,
                student_id,
                first_name,
                last_name,
                email,
                phone,
                dob,
                gender,
                now.format("%Y").to_string().parse::<i32>().unwrap(),
                semester,
                job.file_name,
                now.to_rfc3339()
            )
            .execute(&state.pool)
            .await?;
            imported += 1;
        }
    }

    sqlx::query!(
        "update import_jobs set status = 'imported', imported_count = $1 where file_name = $2",
        imported + reconciled,
        job.file_name
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "imported": imported, "reconciled": reconciled, "skipped": skipped, "total": job.rows.len() })))
}

async fn list_jobs(State(state): State<AppState>, Session(ctx): Session) -> AppResult<Json<serde_json::Value>> {
    authorize(&state.pool, &ctx, "data.import", None, AuthorizeOptions::default()).await?;
    let rows = sqlx::query!("select * from import_jobs order by created_at").fetch_all(&state.pool).await?;
    let out: Vec<_> = rows
        .into_iter()
        .map(|r| json!({
            "id": r.id, "fileName": r.file_name, "sourceFormat": r.source_format, "targetEntity": r.target_entity, "status": r.status,
            "rowCount": r.row_count, "importedCount": r.imported_count, "createdAt": r.created_at,
        }))
        .collect();
    Ok(Json(json!({ "jobs": out })))
}
