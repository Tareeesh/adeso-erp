-- =============================================
-- MIGRATION 004: HR Module Tables
-- =============================================

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  head_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES departments(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees (extended user profiles)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_number VARCHAR(100),
  department_id UUID REFERENCES departments(id),
  job_title VARCHAR(255),
  employment_type VARCHAR(50) CHECK (employment_type IN ('full_time','part_time','contract','intern','consultant')),
  employment_status VARCHAR(50) DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','suspended','terminated','resigned')),
  start_date DATE,
  end_date DATE,
  line_manager_id UUID REFERENCES employees(id),
  salary DECIMAL(15,2),
  salary_currency VARCHAR(10) DEFAULT 'KES',
  work_location VARCHAR(255),
  nationality VARCHAR(100),
  national_id VARCHAR(100),
  passport_number VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  emergency_contact JSONB DEFAULT '{}',
  bank_details JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruitment Requests
CREATE TABLE recruitment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  department_id UUID REFERENCES departments(id),
  position_title VARCHAR(255) NOT NULL,
  position_count INT DEFAULT 1,
  employment_type VARCHAR(50),
  justification TEXT NOT NULL,
  urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','urgent')),
  salary_range_min DECIMAL(15,2),
  salary_range_max DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  required_skills JSONB DEFAULT '[]',
  required_qualifications TEXT,
  job_description TEXT,
  target_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Postings
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recruitment_request_id UUID NOT NULL REFERENCES recruitment_requests(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  posted_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  posting_type VARCHAR(20) DEFAULT 'both' CHECK (posting_type IN ('internal','external','both')),
  platforms JSONB DEFAULT '[]',
  application_deadline DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Applications
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  applicant_name VARCHAR(255) NOT NULL,
  applicant_email VARCHAR(255) NOT NULL,
  applicant_phone VARCHAR(50),
  resume_url TEXT,
  cover_letter TEXT,
  source VARCHAR(100),
  status VARCHAR(30) DEFAULT 'received' CHECK (status IN ('received','shortlisted','interview_scheduled','interviewed','offer_sent','hired','rejected','withdrawn')),
  score DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interviews
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES job_applications(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  scheduled_by UUID NOT NULL REFERENCES users(id),
  interview_type VARCHAR(50) CHECK (interview_type IN ('phone','video','in_person','panel')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  location TEXT,
  interviewers JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  feedback JSONB DEFAULT '[]',
  overall_score DECIMAL(5,2),
  recommendation VARCHAR(30) CHECK (recommendation IN ('hire','reject','consider','second_interview')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offer Letters
CREATE TABLE offer_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES job_applications(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  created_by UUID NOT NULL REFERENCES users(id),
  candidate_name VARCHAR(255) NOT NULL,
  candidate_email VARCHAR(255) NOT NULL,
  position_title VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  start_date DATE,
  salary DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'KES',
  employment_type VARCHAR(50),
  probation_months INT DEFAULT 3,
  additional_terms TEXT,
  acceptance_status VARCHAR(20) DEFAULT 'pending' CHECK (acceptance_status IN ('pending','accepted','declined','expired')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Processes
CREATE TABLE onboarding_processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  managed_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','on_hold')),
  start_date DATE,
  target_completion_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Tasks
CREATE TABLE onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_processes(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  task_type VARCHAR(50),
  assigned_to UUID REFERENCES users(id),
  description TEXT,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IT Account Requests
CREATE TABLE it_account_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  onboarding_id UUID REFERENCES onboarding_processes(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  request_types JSONB DEFAULT '[]',
  email_address VARCHAR(255),
  system_roles JSONB DEFAULT '[]',
  access_level VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Induction Checklists
CREATE TABLE induction_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES onboarding_processes(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Induction Items
CREATE TABLE induction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES induction_checklists(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  acknowledgment_signature TEXT,
  sort_order INT DEFAULT 0
);

-- Performance Reviews
CREATE TABLE performance_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  review_period VARCHAR(20) CHECK (review_period IN ('quarterly','annual','probation','adhoc')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','self_assessment','manager_review','hr_review','completed')),
  kpi_scores JSONB DEFAULT '[]',
  self_assessment TEXT,
  manager_feedback TEXT,
  hr_comments TEXT,
  overall_rating DECIMAL(3,1),
  promotion_eligible BOOLEAN DEFAULT false,
  improvement_plan TEXT,
  goals_next_period JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_recruitment_company ON recruitment_requests(company_id);
CREATE INDEX idx_applications_posting ON job_applications(job_posting_id);
CREATE INDEX idx_performance_employee ON performance_reviews(employee_id);
CREATE INDEX idx_onboarding_employee ON onboarding_processes(employee_id);
