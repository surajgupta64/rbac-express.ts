# RBAC API Documentation

> **Collection:** RBAC — Role-Based Access Control  
> **Base URL:** `{{baseUrl}}` (e.g. `http://localhost:3000`)  
> **Authentication:** Bearer Token (JWT) — obtained via `POST /auth/login`  
> **Token Refresh:** Tokens expire in **3 hours (10800 seconds)**; use `/auth/refresh` to renew.

---

## Table of Contents

1. [Roles Overview](#roles-overview)
2. [Permission Matrix](#permission-matrix)
3. [Authentication APIs](#authentication-apis)
4. [Organization Management APIs](#organization-management-apis)
5. [Department APIs](#department-apis)
6. [HRMS APIs](#hrms-apis)
7. [Attendance APIs](#attendance-apis)
8. [Tracking APIs](#tracking-apis)
9. [CRM APIs](#crm-apis)
10. [Sales APIs](#sales-apis)
11. [Role-by-Role API Guide](#role-by-role-api-guide)
12. [Error Responses & Access Denied Cases](#error-responses--access-denied-cases)

---

## Roles Overview

The system implements five distinct roles arranged in a hierarchy, each with different levels of access:

| Role                 | Level        | Scope                                                     | Test Credentials                        |
| -------------------- | ------------ | --------------------------------------------------------- | --------------------------------------- |
| **Super Admin**      | Platform     | Full platform-wide access across all organizations        | `superadmin@davandee.com` / `Password1` |
| **Super Admin Team** | Platform     | Read-only platform access; no write/manage operations     | `team@davandee.com` / `Password1`       |
| **Org Admin**        | Organization | Full access within their own organization                 | `alice@acme.com` / `Password1`          |
| **Org Manager**      | Organization | Limited org access — can manage attendance & view reports | `mike@acme.com` / `Password1`           |
| **Org Employee**     | Organization | Minimal access — own attendance only                      | `lisa@acme.com` / `Password1`           |

> **Tenant Isolation:** All org-scoped roles are strictly confined to their own organization. Attempting to access another organization's data (e.g., `/orgs/{{orgGlobex}}/...` while logged in as an Acme user) will result in a `403 Forbidden` error.

---

## Permission Matrix

`✅ Allowed` &nbsp;|&nbsp; `❌ Denied`

### Organization Management

| Operation      | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| -------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List All Orgs  |     ✅      |   ✅    |    ❌     |     ❌      |      ❌      |
| Get Org by ID  |     ✅      |   ✅    |    ❌     |     ❌      |      ❌      |
| Create Org     |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |
| Update Org     |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |
| Activate Org   |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |
| Deactivate Org |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |
| Delete Org     |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |

### Departments

| Operation              | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| ---------------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List Departments       |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Get Department         |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Create Department      |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Update Department      |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Delete Department      |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Reassign Employee Dept |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |

### HRMS

| Operation                     | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| ----------------------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List All Employees (All Orgs) |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |
| List Org Employees            |     ✅      |   ❌    |    ✅     |     ✅      |      ✅      |
| Create Employee               |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Update Employee               |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Activate Employee             |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Deactivate Employee           |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| Delete Employee               |     ✅      |   ❌    |    ✅     |     ❌      |      ❌      |
| View Payroll                  |     ✅      |   ❌    |    ❌     |     ❌      |      ❌      |

### Attendance

| Operation       | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| --------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List Attendance |     ✅      |   ❌    |    ✅     |     ✅      |      ✅      |
| Clock In        |     ❌      |   ❌    |    ❌     |     ✅      |      ✅      |
| Clock Out       |     ❌      |   ❌    |    ✅     |     ✅      |      ✅      |

### Tracking

| Operation            | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| -------------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| Get Locations        |     ✅      |   ❌    |    ✅     |     ✅      |      ❌      |
| Get Tracking History |     ✅      |   ❌    |    ✅     |     ✅      |      ❌      |
| Check In Location    |     ❌      |   ❌    |    ❌     |     ❌      |      ❌      |

### CRM

| Operation      | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| -------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List Leads     |     ✅      |   ❌    |    ✅     |     ✅      |      ❌      |
| Create Lead    |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Get Lead by ID |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Update Lead    |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Delete Lead    |     ❌      |   ❌    |    ❌     |     ❌      |      ❌      |

### Sales

| Operation       | Super Admin | SA Team | Org Admin | Org Manager | Org Employee |
| --------------- | :---------: | :-----: | :-------: | :---------: | :----------: |
| List Orders     |     ✅      |   ❌    |    ✅     |     ✅      |      ❌      |
| Create Order    |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Get Order by ID |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Update Order    |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |
| Delete Order    |     ❌      |   ❌    |    ❌     |     ❌      |      ❌      |
| List Targets    |     ✅      |   ❌    |    ✅     |     ✅      |      ❌      |
| Create Target   |     ❌      |   ❌    |    ✅     |     ❌      |      ❌      |

---

## Authentication APIs

All roles share the same authentication endpoints. The token obtained from login must be sent as a `Bearer` token in the `Authorization` header for all subsequent requests.

---

### `POST /auth/login`

Authenticates a user and returns access & refresh tokens.

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "superadmin@davandee.com",
  "password": "Password1"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "<JWT>",
    "refreshToken": "<token>",
    "expiresIn": 10800,
    "user": {
      "id": "07429638-725f-4eaa-a06f-a80ab1e8f173",
      "email": "superadmin@davandee.com",
      "name": "Super Admin",
      "role": "superadmin",
      "level": "platform",
      "orgId": null,
      "departmentId": null
    }
  }
}
```

> **Postman Note:** The login request includes a test script that automatically stores `accessToken` → `{{token}}` and `refreshToken` → `{{refreshToken}}` as collection variables.

**Role-specific credentials:**

| Role             | Email                     | Password    |
| ---------------- | ------------------------- | ----------- |
| Super Admin      | `superadmin@davandee.com` | `Password1` |
| Super Admin Team | `team@davandee.com`       | `Password1` |
| Org Admin        | `alice@acme.com`          | `Password1` |
| Org Manager      | `mike@acme.com`           | `Password1` |
| Org Employee     | `lisa@acme.com`           | `Password1` |

---

### `GET /auth/me`

Returns the currently authenticated user's profile.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "id": "07429638-725f-4eaa-a06f-a80ab1e8f173",
    "email": "superadmin@davandee.com",
    "role": "superadmin",
    "orgId": null,
    "departmentId": null,
    "isActive": true,
    "createdAt": "2026-03-22T05:01:20.747Z"
  }
}
```

**Access:** All roles ✅

---

### `POST /auth/refresh`

Issues a new access token using a valid refresh token. Does not require `Authorization` header.

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "<new JWT>",
    "refreshToken": "<new refresh token>",
    "expiresIn": 10800
  }
}
```

**Access:** All roles ✅ (no auth header needed)

---

### `POST /auth/password/change`

Allows any authenticated user to change their own password. After a successful change, the user must log in again.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "Password1",
  "newPassword": "NewSecure123"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "message": "Password changed successfully. Please log in again."
}
```

**Access:** All roles ✅

---

### `POST /auth/logout`

Invalidates the provided refresh token, ending the session.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "message": "Logged out successfully"
}
```

**Access:** All roles ✅

---

## Organization Management APIs

> **Access:** Super Admin only for write operations. Super Admin Team can read. All org-level roles are denied access entirely.

---

### `GET /org`

Lists all organizations registered on the platform.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    { "id": "...", "name": "Acme Corp", "slug": "acme-corp", "isActive": true },
    { "id": "...", "name": "Globex", "slug": "globex", "isActive": true }
  ]
}
```

**Access:** Super Admin ✅ | Super Admin Team ✅ | Org Admin ❌ | Org Manager ❌ | Org Employee ❌

---

### `GET /org/:orgId`

Returns details of a specific organization by ID.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Path Param:** `orgId` — UUID of the organization (e.g. `{{orgAcme}}`)

**Access:** Super Admin ✅ | Super Admin Team ✅ | Others ❌

---

### `POST /org`

Creates a new organization. Only the Super Admin can do this.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Test Org",
  "slug": "test-org-unique-slug"
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": "<new-org-uuid>",
    "name": "Test Org",
    "slug": "test-org-unique-slug",
    "isActive": true
  }
}
```

**Access:** Super Admin ✅ | All others ❌

---

### `PUT /org/:orgId`

Updates an existing organization's name and/or slug.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Acme Corp Renamed",
  "slug": "acme-corp-v2"
}
```

**Access:** Super Admin ✅ | All others ❌

---

### `PATCH /org/:orgId/activate`

Activates a previously deactivated organization.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Access:** Super Admin ✅ | All others ❌

---

### `PATCH /org/:orgId/deactivate`

Deactivates an organization, preventing its users from accessing the platform.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Access:** Super Admin ✅ | All others ❌

---

### `DELETE /org/:orgId`

Permanently deletes an organization and all associated data.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Access:** Super Admin ✅ | All others ❌

---

## Department APIs

> **Access:** Super Admin and Org Admin have full CRUD. All other roles are denied.

Base path: `/orgs/:orgId/departments`

---

### `GET /orgs/:orgId/departments`

Lists all departments within an organization.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    { "id": "2d8e37c0-...", "name": "Engineering", "orgId": "..." },
    { "id": "3c43580f-...", "name": "Sales", "orgId": "..." }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `GET /orgs/:orgId/departments/:departmentId`

Returns a single department by its ID.

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `POST /orgs/:orgId/departments`

Creates a new department within the organization.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Marketing"
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `PUT /orgs/:orgId/departments/:departmentId`

Updates the name of an existing department.

**Request Body:**

```json
{
  "name": "Tech"
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `DELETE /orgs/:orgId/departments/:departmentId`

Permanently deletes a department.

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `PATCH /orgs/:orgId/employees/:employeeId/department`

Reassigns an employee to a different department.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "departmentId": "2d8e37c0-fdb8-4e59-8ad5-1842511b5687"
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

## HRMS APIs

> Human Resource Management System endpoints handle employee lifecycle operations.

Base path: `/orgs/:orgId/employees`

---

### `GET /orgs/employees`

Lists employees across **all** organizations on the platform. This is a platform-level view.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Access:** Super Admin only ✅ | All others ❌

---

### `GET /orgs/:orgId/employees`

Lists all employees within a specific organization. Org-level roles can only see employees in their own org.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "...",
      "name": "Alice Admin",
      "email": "alice@acme.com",
      "role": "org_admin",
      "departmentId": null,
      "isActive": true
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ✅ | SA Team ❌

---

### `POST /orgs/:orgId/employees`

Creates a new employee (user) within the organization. Assigns a role and optional department.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Suraj Admin",
  "email": "suraj@acme.com",
  "role": "org_admin",
  "departmentId": "2d8e37c0-fdb8-4e59-8ad5-1842511b5687"
}
```

**Available roles for new employees:** `org_admin`, `org_manager`, `org_employee`

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `PUT /orgs/:orgId/employees/:employeeId`

Updates an employee's profile — name, email, role, or department assignments.

**Request Body:**

```json
{
  "name": "Mike Manager",
  "email": "mike@acme.com",
  "role": "org_manager",
  "departmentIds": [
    "2d8e37c0-fdb8-4e59-8ad5-1842511b5687",
    "3c43580f-d480-479d-ad86-004d002df73d"
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `PATCH /orgs/:orgId/employees/:employeeId/activate`

Reactivates a previously deactivated employee account.

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `PATCH /orgs/:orgId/employees/:employeeId/deactivate`

Deactivates an employee account without deleting it.

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `DELETE /orgs/:orgId/employees/:employeeId`

Permanently removes an employee record from the organization.

**Access:** Super Admin ✅ | Org Admin ✅ | Others ❌

---

### `GET /orgs/:orgId/payroll`

Retrieves payroll data for the organization. This is a highly restricted, platform-level only operation — even Org Admins cannot access payroll.

**Access:** Super Admin only ✅ | All others ❌

---

## Attendance APIs

> Attendance tracking for clocking in and out of shifts.

Base path: `/orgs/:orgId/attendance`

---

### `GET /orgs/:orgId/attendance`

Returns the attendance records for the organization. Managers and Admins see all employees; Employees see their own.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "...",
      "employeeId": "...",
      "clockIn": "2026-03-22T09:00:00.000Z",
      "clockOut": "2026-03-22T18:00:00.000Z"
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ✅ | SA Team ❌

---

### `POST /orgs/:orgId/attendance/clock-in`

Records an employee's clock-in time. Managers can clock in on behalf of an employee by providing `employeeId`; employees submit their own ID.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body (Org Manager / Org Employee):**

```json
{
  "employeeId": "206ad721-b473-4fd0-8110-ab3d68a18853"
}
```

**Success Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "id": "...",
    "employeeId": "...",
    "clockIn": "2026-03-22T09:00:00.000Z",
    "clockOut": null
  }
}
```

**Access:** Org Manager ✅ | Org Employee ✅ | Super Admin ❌ | Org Admin ❌ | SA Team ❌

---

### `POST /orgs/:orgId/attendance/clock-out`

Records an employee's clock-out time. Closes the open clock-in session for the current user.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:** `{}` (empty — derives employee from token context)

**Access:** Org Admin ✅ | Org Manager ✅ | Org Employee ✅ | Super Admin ❌ | SA Team ❌

---

## Tracking APIs

> Location and field staff tracking. Managers and Admins can view; no role can check in via API in the current collection (all flagged ❌).

Base path: `/orgs/:orgId/tracking`

---

### `GET /orgs/:orgId/tracking/locations`

Returns the current known locations of all tracked field staff in the organization.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "userId": "field-staff-001",
      "latitude": 28.6139,
      "longitude": 77.209,
      "timestamp": "2026-03-22T10:30:00.000Z"
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ❌ | SA Team ❌

---

### `GET /orgs/:orgId/tracking/history/:userId`

Returns the historical location trail for a specific user/field staff.

**Path Param:** `:userId` — e.g. `field-staff-001` or `{{userId}}`

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ❌ | SA Team ❌

---

### `POST /orgs/:orgId/tracking/checkin`

Submits a location check-in for a field staff member.

**Request Body:**

```json
{
  "latitude": 28.6139,
  "longitude": 77.209
}
```

**Access:** ❌ All roles denied in current collection configuration

---

## CRM APIs

> Customer Relationship Management — lead management. Only Org Admin has full CRUD; others have read-only or no access.

Base path: `/orgs/:orgId/crm/leads`

---

### `GET /orgs/:orgId/crm/leads`

Returns the list of all CRM leads for the organization.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+919876543210",
      "company": "Test Corp",
      "status": "new",
      "source": "website"
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ❌ | SA Team ❌

---

### `POST /orgs/:orgId/crm/leads`

Creates a new lead in the CRM.

**Headers:**

```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Test Lead",
  "email": "testlead@example.com",
  "phone": "+919876543210",
  "company": "Test Corp",
  "status": "new",
  "source": "website"
}
```

**Status values:** `new`, `contacted`, `qualified`, `proposal`, `closed`

**Access:** Org Admin ✅ | Super Admin ❌ | Org Manager ❌ | Org Employee ❌ | SA Team ❌

---

### `GET /orgs/:orgId/crm/leads/:leadId`

Returns a specific lead by its ID.

**Access:** Org Admin ✅ | All others ❌

---

### `PUT /orgs/:orgId/crm/leads/:leadId`

Updates an existing lead — e.g. changing status or adding notes.

**Request Body:**

```json
{
  "status": "qualified",
  "notes": "Interested in enterprise plan"
}
```

**Access:** Org Admin ✅ | All others ❌

---

### `DELETE /orgs/:orgId/crm/leads/:leadId`

Permanently deletes a lead.

**Access:** ❌ All roles denied

---

## Sales APIs

> Orders and sales targets management.

Base path: `/orgs/:orgId/sales`

---

### `GET /orgs/:orgId/sales/orders`

Lists all sales orders for the organization.

**Headers:**

```
Authorization: Bearer {{token}}
```

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "...",
      "customerName": "Test Client",
      "amount": 25000,
      "currency": "INR",
      "status": "pending"
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ❌ | SA Team ❌

---

### `POST /orgs/:orgId/sales/orders`

Creates a new sales order.

**Request Body:**

```json
{
  "customerName": "Test Client",
  "amount": 25000,
  "currency": "INR"
}
```

**Access:** Org Admin ✅ | All others ❌

---

### `GET /orgs/:orgId/sales/orders/:orderId`

Returns a specific order by its ID.

**Access:** Org Admin ✅ | All others ❌

---

### `PUT /orgs/:orgId/sales/orders/:orderId`

Updates an existing order, e.g., marking it as delivered.

**Request Body:**

```json
{
  "status": "delivered",
  "notes": "Delivered successfully"
}
```

**Status values:** `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`

**Access:** Org Admin ✅ | All others ❌

---

### `DELETE /orgs/:orgId/sales/orders/:orderId`

Permanently deletes a sales order.

**Access:** ❌ All roles denied

---

### `GET /orgs/:orgId/sales/targets`

Returns all sales targets defined for the organization.

**Success Response (200):**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "...",
      "name": "Q1 2026 Revenue",
      "target": 500000,
      "achieved": 320000,
      "currency": "INR",
      "startDate": "2026-01-01",
      "endDate": "2026-03-31"
    }
  ]
}
```

**Access:** Super Admin ✅ | Org Admin ✅ | Org Manager ✅ | Org Employee ❌ | SA Team ❌

---

### `POST /orgs/:orgId/sales/targets`

Creates a new sales target.

**Request Body:**

```json
{
  "name": "Q1 2026 Revenue",
  "target": 500000,
  "achieved": 320000,
  "currency": "INR",
  "startDate": "2026-01-01",
  "endDate": "2026-03-31"
}
```

**Access:** Org Admin ✅ | All others ❌

---

## Role-by-Role API Guide

### 🔴 Super Admin (`superadmin@davandee.com`)

The Super Admin has **unrestricted, platform-wide access**. This role can perform every read and write operation across all organizations.

**Unique capabilities:**

- Only role that can **Create, Update, Activate, Deactivate, and Delete Organizations**
- Only role that can **view Payroll** data
- Only role that can **List All Employees across all organizations** (`GET /orgs/employees`)
- Has `canImpersonate: true` in the JWT payload
- JWT permissions include `["read", "write", "delete", "manage"]` for all modules: `platform`, `hrms`, `attendance`, `tracking`, `crm`, `sales`

**What Super Admin CANNOT do in this collection:**

- Clock in/out (not an employee function)
- Create CRM leads, orders, or targets (these are org-level operations)

---

### 🟠 Super Admin Team (`team@davandee.com`)

The Super Admin Team has **read-only platform access**. They can see organizations but cannot modify anything.

**Allowed:**

- Login / Get Me / Refresh / Change Password / Logout
- `GET /org` — List All Orgs
- `GET /org/:orgId` — Get Org by ID

**Denied (everything else):**

- All write operations on orgs (Create, Update, Activate, Deactivate, Delete)
- All Department APIs
- All HRMS APIs (including listing org employees)
- Attendance, Tracking, CRM, Sales

---

### 🟡 Org Admin (`alice@acme.com`)

The Org Admin is the **highest-level role within an organization**, with full CRUD over their own org's data — but completely blocked from platform-level views.

**Allowed:**

- Login / Auth operations
- Full Department management (List, Get, Create, Update, Delete, Reassign)
- Full Employee management within their org (List, Create, Update, Activate, Deactivate, Delete)
- Attendance: List & Clock Out
- Tracking: View Locations & Tracking History
- CRM: List, Create, Get, Update leads
- Sales: List, Create, Get, Update orders & List, Create targets

**Denied:**

- `GET /org` — cannot list all organizations
- `GET /org/:orgId` — cannot access org-level details
- `GET /orgs/employees` — cannot see employees across all orgs
- `GET /orgs/:orgId/payroll` — payroll is Super Admin only
- `POST /attendance/clock-in` — Admins don't clock in
- `POST /tracking/checkin` — location check-in not permitted
- `DELETE` on leads, orders — deletion is fully restricted
- Accessing any other organization's data (tenant isolation enforced)

---

### 🔵 Org Manager (`mike@acme.com`)

The Org Manager has **operational access** — they can view reports and manage day-to-day activities like attendance, but cannot modify organizational structure.

**Allowed:**

- Login / Auth operations
- `GET /orgs/:orgId/employees` — List employees (read-only)
- Attendance: List records, Clock In (for employees), Clock Out
- Tracking: View Locations & History
- CRM: List leads only
- Sales: List orders, List targets

**Denied:**

- All Organization and Department management
- Creating/editing/deleting employees
- Creating/editing CRM leads
- Creating orders or targets
- Payroll access
- Accessing other organizations' data

---

### 🟢 Org Employee (`lisa@acme.com`)

Org Employees have the **most restricted access**, limited primarily to their own attendance.

**Allowed:**

- Login / Auth operations
- `GET /orgs/:orgId/employees` — Can view the employee list
- Attendance: List records, Clock In (own), Clock Out

**Denied:**

- Everything else — no access to Departments, Tracking, CRM, Sales, Payroll, or any write operations

---

## Error Responses & Access Denied Cases

### `401 Unauthorized`

Returned when no token is provided or the token is expired.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### `403 Forbidden`

Returned when a valid token exists but the role does not have permission for the requested operation.

```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

**Common 403 scenarios:**

- Super Admin Team trying to Create/Update/Delete an org
- Org Admin accessing `GET /org` or `GET /orgs/employees`
- Org Manager trying to create/edit employees or leads
- Org Employee accessing tracking, CRM, or sales endpoints
- Any org-level role accessing another org's data (Tenant Violation)

### Tenant Violation (403)

When an org-scoped user tries to access another organization's data:

```
GET /orgs/{{orgGlobex}}/employees
Authorization: Bearer <acme-org-token>
```

```json
{
  "statusCode": 403,
  "message": "Access denied to this organization"
}
```

---

## Postman Variables Reference

| Variable           | Description                                                  | Example Value           |
| ------------------ | ------------------------------------------------------------ | ----------------------- |
| `{{baseUrl}}`      | API base URL                                                 | `http://localhost:3000` |
| `{{token}}`        | Current access token (auto-set on login)                     | JWT string              |
| `{{refreshToken}}` | Current refresh token (auto-set on login)                    | hex string              |
| `{{orgAcme}}`      | UUID of the Acme Corp organization                           | `<uuid>`                |
| `{{orgGlobex}}`    | UUID of the Globex organization (for tenant violation tests) | `<uuid>`                |
| `{{departmentId}}` | UUID of a department                                         | `<uuid>`                |
| `{{employeeId}}`   | UUID of an employee                                          | `<uuid>`                |
| `{{leadId}}`       | UUID of a CRM lead                                           | `<uuid>`                |
| `{{orderId}}`      | UUID of a sales order                                        | `<uuid>`                |
| `{{userId}}`       | User ID for tracking history                                 | e.g. `field-staff-001`  |

---

_Generated from RBAC Postman Collection — Last updated: March 22, 2026_
