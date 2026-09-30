use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Scope {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub all: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_id: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_ids: Option<Vec<i32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub course_ids: Option<Vec<i32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct ResourceNeed {
    pub student_id: Option<i32>,
    pub course_id: Option<i32>,
    pub department_id: Option<i32>,
    pub employee_id: Option<i32>,
}

impl ResourceNeed {
    pub fn student(id: i32) -> Self {
        ResourceNeed { student_id: Some(id), ..Default::default() }
    }
    pub fn course(id: i32) -> Self {
        ResourceNeed { course_id: Some(id), ..Default::default() }
    }
}

#[derive(Debug, Clone)]
pub struct Grant {
    pub permission: String,
    pub scope: Option<Scope>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoleLabel {
    pub key: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientContext {
    pub user_id: i32,
    pub role: String,
    pub name: String,
    pub student_id: Option<i32>,
    pub faculty_id: Option<i32>,
    pub parent_id: Option<i32>,
    pub employee_id: Option<i32>,
    pub department_id: Option<i32>,
    pub department_name: Option<String>,
    pub roles: Vec<RoleLabel>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AccessContext {
    pub user_id: i32,
    pub role: String,
    pub name: String,
    pub student_id: Option<i32>,
    pub faculty_id: Option<i32>,
    pub parent_id: Option<i32>,
    pub employee_id: Option<i32>,
    pub department_id: Option<i32>,
    pub department_name: Option<String>,
    pub roles: Vec<RoleLabel>,
    pub permissions: Vec<String>,
    pub grants: Vec<Grant>,
}

impl AccessContext {
    pub fn to_client(&self) -> ClientContext {
        ClientContext {
            user_id: self.user_id,
            role: self.role.clone(),
            name: self.name.clone(),
            student_id: self.student_id,
            faculty_id: self.faculty_id,
            parent_id: self.parent_id,
            employee_id: self.employee_id,
            department_id: self.department_id,
            department_name: self.department_name.clone(),
            roles: self.roles.clone(),
            permissions: self.permissions.clone(),
        }
    }
}

pub fn parse_scope(raw: Option<&str>) -> Option<Scope> {
    let raw = raw?;
    serde_json::from_str(raw).ok()
}
