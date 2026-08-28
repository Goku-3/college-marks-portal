# College Marks Portal — Local Version

This is a functional local prototype based on the supplied marks-portal specification.

## Run

Install Node.js, then from this folder:

```bash
npm install
npm run dev
```

Open:

http://localhost:3000

## Demo Admin

Username: `admin`
Password: `admin123`

## Excel format

Use columns such as:

| Student ID | Student Name | Signals and Systems | Electrical Machines | C Programming | Mathematics |
|---|---|---:|---:|---:|---:|
| 23EC001 | Rahul Kumar | 18 | 16 | 19 | 17 |

The importer previews/reads the workbook in the browser, detects Student ID/Name columns, validates numeric marks and maximum marks, and stores imported records as DRAFT. Admin can publish them.

## Important

This local version uses browser localStorage so it can be started immediately without Supabase. It is intended for local development/testing. Before using real marks for a class or deploying publicly, replace the localStorage/demo authentication with a proper server-side database and authentication layer such as Supabase, with Row Level Security and server-side Admin authorization.

## Production path

The project can later be migrated to Supabase/PostgreSQL and deployed to Vercel.

## Updated Excel importer

The uploader now supports a one-subject Excel sheet such as:

Student ID | Student Name | MID-1(20)

It can create students from the uploaded Student ID/Name rows, create the subject entered in the Admin upload form, validate marks against Maximum Marks, and import records as DRAFT. Blank/non-numeric/out-of-range marks are reported as warnings/errors rather than silently converted to zero.

For the supplied EEE-E2 P&RV sheet, enter:
- Subject Name: EEE-E2 P&RV
- Maximum Marks: 20
- Exam Type: Mid 1

## Version 3 behavior

The supplied Excel workbook was used to seed the Student ID/Name list in `app/page.tsx`. The portal now has all student IDs from that workbook.

For subject uploads, the subject is automatically derived from the uploaded filename:
`EEE-E2 P&RV AWARD SHEET.xlsx` -> `EEE-E2 P&RV`.

Student marks tables list every uploaded subject for the selected semester. If a subject has not been uploaded for a student, it displays `Not Uploaded` instead of zero. Uploading another subject Excel creates that subject and fills its marks while previously missing subjects remain `Not Uploaded`.
