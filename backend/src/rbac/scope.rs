use super::types::{ResourceNeed, Scope};

pub fn scope_allows(scope: Option<&Scope>, need: Option<&ResourceNeed>) -> bool {
    let need = match need {
        Some(n) => n,
        None => return true,
    };
    let scope = match scope {
        Some(s) => s,
        None => return false,
    };
    if scope.all == Some(true) {
        return true;
    }

    if let Some(student_id) = need.student_id {
        if scope.student_id == Some(student_id) {
            return true;
        }
        if scope.student_ids.as_ref().is_some_and(|ids| ids.contains(&student_id)) {
            return true;
        }
    }
    if let Some(course_id) = need.course_id {
        if scope.course_ids.as_ref().is_some_and(|ids| ids.contains(&course_id)) {
            return true;
        }
    }
    if let Some(department_id) = need.department_id {
        if scope.department_id == Some(department_id) {
            return true;
        }
    }
    if let Some(employee_id) = need.employee_id {
        if scope.employee_id == Some(employee_id) {
            return true;
        }
    }
    false
}
