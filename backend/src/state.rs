use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use sqlx::PgPool;

use crate::routes::import_data::ImportJob;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub import_jobs: Arc<Mutex<HashMap<String, ImportJob>>>,
}
