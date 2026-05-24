# Multi-Tenant SaaS + Stripe Payments

Add clinic-scoped multi-tenancy and Stripe subscription payments to DoctorHelp.

## Data Model

### New: `clinics` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Clinic name (auto-generated from doctor's name) |
| code | text | Unique short code for check-in URL (e.g., `abc123`) |
| stripe_customer_id | text | Stripe customer ID |
| stripe_subscription_id | text | Stripe subscription ID |
| subscription_status | text | `active` or `inactive` |
| plan | text | `starter` or `professional` |
| created_at | timestamptz | |

Unique constraint on `code`.

### New: `doctors` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK → auth.users |
| clinic_id | uuid | FK → clinics |
| name | text | Doctor's display name |
| created_at | timestamptz | |

### Modified: `sessions` table

Add `clinic_id uuid references clinics(id)` — every session is scoped to a clinic.

## Flow

1. Doctor visits `/pricing` → clicks plan → goes to `/signup?plan=starter`
2. Signup page: enters name, email, password → Supabase Auth creates user
3. POST `/api/stripe/checkout` → creates Stripe Checkout session with plan price
4. Doctor redirected to Stripe Checkout → pays
5. Stripe redirects to `/api/stripe/success?session_id=...` → creates clinic + doctor rows → redirects to `/dashboard`
6. Dashboard shows clinic's unique check-in link: `/checkin/[code]`
7. Patient scans QR → `/checkin/[code]` → session created with `clinic_id`
8. Dashboard only shows sessions matching doctor's `clinic_id`

## Pages

| Route | Change |
|-------|--------|
| `/signup` | NEW — doctor registration form |
| `/pricing` | UPDATE — buttons link to `/signup?plan=X` |
| `/checkin/[clinicCode]` | NEW — replaces `/checkin`, scoped to clinic |
| `/checkin` | KEEP — redirect to home or show "scan QR code" message |
| `/dashboard` | UPDATE — filter by clinic_id, show check-in link |
| `/api/stripe/checkout` | NEW — create Stripe Checkout session |
| `/api/stripe/success` | NEW — handle post-payment, create clinic + doctor |
| `/api/sessions` | UPDATE — accept clinic_id from check-in |

## Stripe Integration

- Stripe Checkout (hosted) — no custom payment form needed
- Two products: Starter ($49/mo), Professional ($149/mo)
- Using success URL redirect (not webhooks) for hackathon simplicity
- Test mode for development, live mode for real revenue

## Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```
