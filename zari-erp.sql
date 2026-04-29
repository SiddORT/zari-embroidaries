--
-- PostgreSQL database dump
--

\restrict EmvhKPwwW2gq9a5HGXtlXnP1to2zNaZkanjfWLkz7NdTeSGW5ZS6WlKHIZIc5ed

-- Dumped from database version 16.12 (0c42b1f)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _system; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA _system;


ALTER SCHEMA _system OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: replit_database_migrations_v1; Type: TABLE; Schema: _system; Owner: neondb_owner
--

CREATE TABLE _system.replit_database_migrations_v1 (
    id bigint NOT NULL,
    build_id text NOT NULL,
    deployment_id text NOT NULL,
    statement_count bigint NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE _system.replit_database_migrations_v1 OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE; Schema: _system; Owner: neondb_owner
--

CREATE SEQUENCE _system.replit_database_migrations_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: _system; Owner: neondb_owner
--

ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNED BY _system.replit_database_migrations_v1.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_email text NOT NULL,
    user_name text DEFAULT ''::text NOT NULL,
    method text NOT NULL,
    url text NOT NULL,
    action text DEFAULT ''::text NOT NULL,
    status_code integer DEFAULT 200 NOT NULL,
    ip_address text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO neondb_owner;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO neondb_owner;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: artisan_timesheets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.artisan_timesheets (
    id integer NOT NULL,
    swatch_order_id integer,
    no_of_artisans integer DEFAULT 1 NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    shift_type text DEFAULT 'regular'::text NOT NULL,
    total_hours text DEFAULT '0'::text NOT NULL,
    hourly_rate text DEFAULT '0'::text NOT NULL,
    total_rate text DEFAULT '0'::text NOT NULL,
    notes text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    style_order_id integer,
    style_order_product_id integer,
    style_order_product_name text
);


ALTER TABLE public.artisan_timesheets OWNER TO neondb_owner;

--
-- Name: artisan_timesheets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.artisan_timesheets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.artisan_timesheets_id_seq OWNER TO neondb_owner;

--
-- Name: artisan_timesheets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.artisan_timesheets_id_seq OWNED BY public.artisan_timesheets.id;


--
-- Name: artworks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.artworks (
    id integer NOT NULL,
    artwork_code text NOT NULL,
    swatch_order_id integer NOT NULL,
    artwork_name text NOT NULL,
    unit_length text,
    unit_width text,
    unit_type text,
    artwork_created text DEFAULT 'Inhouse'::text NOT NULL,
    work_hours text,
    hourly_rate text,
    total_cost text,
    feedback_status text DEFAULT 'Pending'::text NOT NULL,
    files jsonb DEFAULT '[]'::jsonb,
    ref_images jsonb DEFAULT '[]'::jsonb,
    wip_images jsonb DEFAULT '[]'::jsonb,
    final_images jsonb DEFAULT '[]'::jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    outsource_vendor_id text,
    outsource_vendor_name text,
    outsource_payment_date text,
    outsource_payment_amount text,
    outsource_payment_mode text,
    outsource_transaction_id text,
    outsource_payment_status text
);


ALTER TABLE public.artworks OWNER TO neondb_owner;

--
-- Name: artworks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.artworks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.artworks_id_seq OWNER TO neondb_owner;

--
-- Name: artworks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.artworks_id_seq OWNED BY public.artworks.id;


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bank_accounts (
    id integer NOT NULL,
    bank_name text NOT NULL,
    account_no text NOT NULL,
    ifsc_code text DEFAULT ''::text NOT NULL,
    branch text DEFAULT ''::text NOT NULL,
    account_name text DEFAULT ''::text NOT NULL,
    bank_upi text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bank_accounts OWNER TO neondb_owner;

--
-- Name: bank_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.bank_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bank_accounts_id_seq OWNER TO neondb_owner;

--
-- Name: bank_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bank_accounts_id_seq OWNED BY public.bank_accounts.id;


--
-- Name: bom_change_log; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bom_change_log (
    id integer NOT NULL,
    bom_row_id integer NOT NULL,
    bom_type text NOT NULL,
    order_id integer NOT NULL,
    inventory_id integer,
    material_code text NOT NULL,
    material_name text NOT NULL,
    old_qty text NOT NULL,
    new_qty text NOT NULL,
    delta text NOT NULL,
    reservation_delta text,
    notes text,
    changed_by text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bom_change_log OWNER TO neondb_owner;

--
-- Name: bom_change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.bom_change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bom_change_log_id_seq OWNER TO neondb_owner;

--
-- Name: bom_change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bom_change_log_id_seq OWNED BY public.bom_change_log.id;


--
-- Name: client_feedback; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_feedback (
    id integer NOT NULL,
    client_link_id integer NOT NULL,
    artwork_id integer NOT NULL,
    artwork_name text NOT NULL,
    decision text NOT NULL,
    comment text,
    is_resolved boolean DEFAULT false NOT NULL,
    internal_note text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_feedback OWNER TO neondb_owner;

--
-- Name: client_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_feedback_id_seq OWNER TO neondb_owner;

--
-- Name: client_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_feedback_id_seq OWNED BY public.client_feedback.id;


--
-- Name: client_invoice_ledger; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_invoice_ledger (
    id integer NOT NULL,
    client_id integer,
    invoice_id integer,
    entry_type text DEFAULT 'Payment Received'::text NOT NULL,
    payment_amount numeric(18,2) NOT NULL,
    payment_date text NOT NULL,
    transaction_reference text DEFAULT ''::text,
    status text DEFAULT 'Completed'::text,
    created_by text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.client_invoice_ledger OWNER TO neondb_owner;

--
-- Name: client_invoice_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_invoice_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_invoice_ledger_id_seq OWNER TO neondb_owner;

--
-- Name: client_invoice_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_invoice_ledger_id_seq OWNED BY public.client_invoice_ledger.id;


--
-- Name: client_links; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_links (
    id integer NOT NULL,
    swatch_order_id integer,
    token text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    hidden_images jsonb DEFAULT '[]'::jsonb,
    portal_title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    closed_threads jsonb DEFAULT '[]'::jsonb,
    style_order_id integer
);


ALTER TABLE public.client_links OWNER TO neondb_owner;

--
-- Name: client_links_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_links_id_seq OWNER TO neondb_owner;

--
-- Name: client_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_links_id_seq OWNED BY public.client_links.id;


--
-- Name: client_messages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_messages (
    id integer NOT NULL,
    client_link_id integer NOT NULL,
    artwork_id integer NOT NULL,
    artwork_name text NOT NULL,
    sender text NOT NULL,
    message text,
    attachment jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.client_messages OWNER TO neondb_owner;

--
-- Name: client_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.client_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_messages_id_seq OWNER TO neondb_owner;

--
-- Name: client_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.client_messages_id_seq OWNED BY public.client_messages.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    client_code text NOT NULL,
    brand_name text NOT NULL,
    contact_name text NOT NULL,
    email text NOT NULL,
    alt_email text,
    contact_no text NOT NULL,
    alt_contact_no text,
    country_of_origin text,
    has_gst boolean DEFAULT false NOT NULL,
    gst_no text,
    address1 text,
    address2 text,
    country text,
    state text,
    city text,
    pincode text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    addresses jsonb,
    invoice_currency text DEFAULT 'INR'::text
);


ALTER TABLE public.clients OWNER TO neondb_owner;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO neondb_owner;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: company_gst_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.company_gst_settings (
    gst_settings_id integer NOT NULL,
    company_gstin text DEFAULT ''::text NOT NULL,
    company_state text DEFAULT ''::text NOT NULL,
    company_country text DEFAULT 'India'::text NOT NULL,
    export_under_lut_enabled boolean DEFAULT true NOT NULL,
    reverse_charge_enabled boolean DEFAULT false NOT NULL,
    gst_mode text DEFAULT 'Auto Detect'::text NOT NULL,
    default_service_gst_rate numeric(5,2) DEFAULT '18'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_name text DEFAULT 'ZARI EMBROIDERIES'::text NOT NULL,
    company_address text DEFAULT ''::text NOT NULL,
    company_phone text DEFAULT ''::text NOT NULL,
    company_email text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.company_gst_settings OWNER TO neondb_owner;

--
-- Name: company_gst_settings_gst_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.company_gst_settings_gst_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_gst_settings_gst_settings_id_seq OWNER TO neondb_owner;

--
-- Name: company_gst_settings_gst_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.company_gst_settings_gst_settings_id_seq OWNED BY public.company_gst_settings.gst_settings_id;


--
-- Name: consumption_log; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.consumption_log (
    id integer NOT NULL,
    swatch_order_id integer,
    bom_row_id integer NOT NULL,
    material_code text NOT NULL,
    material_name text NOT NULL,
    material_type text NOT NULL,
    unit_type text DEFAULT ''::text NOT NULL,
    consumed_qty text NOT NULL,
    consumed_by text NOT NULL,
    consumed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    style_order_id integer,
    style_order_product_id integer,
    style_order_product_name text
);


ALTER TABLE public.consumption_log OWNER TO neondb_owner;

--
-- Name: consumption_log_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.consumption_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.consumption_log_id_seq OWNER TO neondb_owner;

--
-- Name: consumption_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.consumption_log_id_seq OWNED BY public.consumption_log.id;


--
-- Name: costing_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.costing_payments (
    id integer NOT NULL,
    vendor_id integer NOT NULL,
    vendor_name text,
    reference_type text NOT NULL,
    reference_id integer NOT NULL,
    swatch_order_id integer,
    style_order_id integer,
    payment_type text,
    payment_mode text,
    payment_amount numeric(12,2) NOT NULL,
    payment_status text DEFAULT 'Pending'::text,
    transaction_id text,
    payment_date timestamp with time zone,
    remarks text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.costing_payments OWNER TO neondb_owner;

--
-- Name: costing_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.costing_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.costing_payments_id_seq OWNER TO neondb_owner;

--
-- Name: costing_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.costing_payments_id_seq OWNED BY public.costing_payments.id;


--
-- Name: credit_debit_notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.credit_debit_notes (
    note_id integer NOT NULL,
    note_number text NOT NULL,
    note_type text NOT NULL,
    reference_type text DEFAULT 'Manual Entry'::text NOT NULL,
    invoice_id integer,
    vendor_bill_id integer,
    party_id integer,
    party_name text,
    party_type text,
    currency_code text DEFAULT 'INR'::text NOT NULL,
    exchange_rate_snapshot numeric(18,6) DEFAULT '1'::numeric NOT NULL,
    note_amount numeric(18,2) NOT NULL,
    base_currency_amount numeric(18,2) NOT NULL,
    reason text NOT NULL,
    remarks text,
    note_date text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.credit_debit_notes OWNER TO neondb_owner;

--
-- Name: credit_debit_notes_note_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.credit_debit_notes_note_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_debit_notes_note_id_seq OWNER TO neondb_owner;

--
-- Name: credit_debit_notes_note_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.credit_debit_notes_note_id_seq OWNED BY public.credit_debit_notes.note_id;


--
-- Name: currencies; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.currencies (
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    decimal_places integer DEFAULT 2 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_base boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.currencies OWNER TO neondb_owner;

--
-- Name: custom_charges; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.custom_charges (
    id integer NOT NULL,
    swatch_order_id integer,
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    hsn_id integer NOT NULL,
    hsn_code text NOT NULL,
    gst_percentage text DEFAULT '5'::text NOT NULL,
    description text NOT NULL,
    unit_price text DEFAULT '0'::text NOT NULL,
    quantity text DEFAULT '1'::text NOT NULL,
    total_amount text DEFAULT '0'::text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    style_order_id integer,
    style_order_product_id integer,
    style_order_product_name text
);


ALTER TABLE public.custom_charges OWNER TO neondb_owner;

--
-- Name: custom_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.custom_charges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.custom_charges_id_seq OWNER TO neondb_owner;

--
-- Name: custom_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.custom_charges_id_seq OWNED BY public.custom_charges.id;


--
-- Name: delivery_addresses; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.delivery_addresses (
    id integer NOT NULL,
    client_id integer NOT NULL,
    label text DEFAULT 'Default'::text NOT NULL,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    country text,
    pincode text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.delivery_addresses OWNER TO neondb_owner;

--
-- Name: delivery_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.delivery_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_addresses_id_seq OWNER TO neondb_owner;

--
-- Name: delivery_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.delivery_addresses_id_seq OWNED BY public.delivery_addresses.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.departments OWNER TO neondb_owner;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO neondb_owner;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: download_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.download_logs (
    id integer NOT NULL,
    user_id integer,
    user_name text DEFAULT ''::text NOT NULL,
    user_email text DEFAULT ''::text NOT NULL,
    file_type text NOT NULL,
    file_name text NOT NULL,
    module text DEFAULT ''::text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    downloaded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.download_logs OWNER TO neondb_owner;

--
-- Name: download_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.download_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.download_logs_id_seq OWNER TO neondb_owner;

--
-- Name: download_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.download_logs_id_seq OWNED BY public.download_logs.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exchange_rates (
    id integer NOT NULL,
    currency_code text NOT NULL,
    rate numeric(20,6) NOT NULL,
    source_type text DEFAULT 'Auto'::text NOT NULL,
    is_manual_override boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exchange_rates OWNER TO neondb_owner;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exchange_rates_id_seq OWNER TO neondb_owner;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;


--
-- Name: fabric_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.fabric_types (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fabric_types OWNER TO neondb_owner;

--
-- Name: fabric_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.fabric_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fabric_types_id_seq OWNER TO neondb_owner;

--
-- Name: fabric_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.fabric_types_id_seq OWNED BY public.fabric_types.id;


--
-- Name: fabrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.fabrics (
    id integer NOT NULL,
    fabric_code text NOT NULL,
    fabric_type text NOT NULL,
    quality text NOT NULL,
    color text,
    hex_code text,
    color_name text NOT NULL,
    width text NOT NULL,
    width_unit_type text NOT NULL,
    price_per_meter text NOT NULL,
    unit_type text NOT NULL,
    current_stock text NOT NULL,
    hsn_code text NOT NULL,
    gst_percent text NOT NULL,
    vendor text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    reorder_level numeric(14,3),
    minimum_level numeric(14,3),
    maximum_level numeric(14,3),
    location_stocks jsonb DEFAULT '[]'::jsonb,
    height text
);


ALTER TABLE public.fabrics OWNER TO neondb_owner;

--
-- Name: fabrics_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.fabrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fabrics_id_seq OWNER TO neondb_owner;

--
-- Name: fabrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.fabrics_id_seq OWNED BY public.fabrics.id;


--
-- Name: hsn_master; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hsn_master (
    id integer NOT NULL,
    hsn_code text NOT NULL,
    gst_percentage text NOT NULL,
    govt_description text NOT NULL,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.hsn_master OWNER TO neondb_owner;

--
-- Name: hsn_master_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hsn_master_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hsn_master_id_seq OWNER TO neondb_owner;

--
-- Name: hsn_master_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hsn_master_id_seq OWNED BY public.hsn_master.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    source_type text NOT NULL,
    source_id integer NOT NULL,
    item_name text NOT NULL,
    item_code text NOT NULL,
    category text,
    department text,
    warehouse_location text,
    unit_type text,
    current_stock numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    style_reserved_qty numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    swatch_reserved_qty numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    available_stock numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    average_price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    last_purchase_price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    minimum_level numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    reorder_level numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    maximum_level numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    preferred_vendor text,
    last_vendor text,
    is_active boolean DEFAULT true NOT NULL,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    images jsonb DEFAULT '[]'::jsonb NOT NULL
);


ALTER TABLE public.inventory_items OWNER TO neondb_owner;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_items_id_seq OWNER TO neondb_owner;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: inventory_stock_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory_stock_logs (
    id integer NOT NULL,
    inventory_item_id integer NOT NULL,
    action_type text NOT NULL,
    quantity_before numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    quantity_after numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    quantity_delta numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    reference_type text,
    reference_id integer,
    notes text,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_stock_logs OWNER TO neondb_owner;

--
-- Name: inventory_stock_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.inventory_stock_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_stock_logs_id_seq OWNER TO neondb_owner;

--
-- Name: inventory_stock_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.inventory_stock_logs_id_seq OWNED BY public.inventory_stock_logs.id;


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_payments (
    payment_id integer NOT NULL,
    invoice_id integer NOT NULL,
    payment_direction text DEFAULT 'Received'::text NOT NULL,
    party_id integer,
    payment_type text DEFAULT 'Bank Transfer'::text NOT NULL,
    payment_amount numeric(18,2) NOT NULL,
    currency_code text DEFAULT 'INR'::text NOT NULL,
    exchange_rate_snapshot numeric(18,6) DEFAULT '1'::numeric NOT NULL,
    base_currency_amount numeric(18,2) NOT NULL,
    transaction_reference text DEFAULT ''::text,
    payment_status text DEFAULT 'Completed'::text NOT NULL,
    payment_date text NOT NULL,
    remarks text DEFAULT ''::text,
    attachment text DEFAULT ''::text,
    created_by text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoice_payments OWNER TO neondb_owner;

--
-- Name: invoice_payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoice_payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_payments_payment_id_seq OWNER TO neondb_owner;

--
-- Name: invoice_payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoice_payments_payment_id_seq OWNED BY public.invoice_payments.payment_id;


--
-- Name: invoice_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_templates (
    id integer NOT NULL,
    name text NOT NULL,
    layout text DEFAULT 'classic'::text NOT NULL,
    payment_terms text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoice_templates OWNER TO neondb_owner;

--
-- Name: invoice_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoice_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_templates_id_seq OWNER TO neondb_owner;

--
-- Name: invoice_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoice_templates_id_seq OWNED BY public.invoice_templates.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    invoice_no text NOT NULL,
    swatch_order_id integer,
    invoice_date text NOT NULL,
    due_date text DEFAULT ''::text,
    client_name text DEFAULT ''::text,
    client_address text DEFAULT ''::text,
    client_gstin text DEFAULT ''::text,
    client_email text DEFAULT ''::text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    discount_type text DEFAULT 'flat'::text,
    discount_value text DEFAULT '0'::text,
    notes text DEFAULT ''::text,
    payment_terms text DEFAULT ''::text,
    status text DEFAULT 'Draft'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    client_phone text DEFAULT ''::text,
    client_state text DEFAULT ''::text,
    cgst_rate text DEFAULT '0'::text,
    sgst_rate text DEFAULT '0'::text,
    bank_name text DEFAULT ''::text,
    bank_account text DEFAULT ''::text,
    bank_ifsc text DEFAULT ''::text,
    bank_branch text DEFAULT ''::text,
    bank_upi text DEFAULT ''::text,
    style_order_id integer,
    invoice_direction text DEFAULT 'Client'::text,
    invoice_type text DEFAULT 'Final Invoice'::text,
    invoice_status text DEFAULT 'Draft'::text,
    client_id integer,
    vendor_id integer,
    reference_type text DEFAULT 'Manual'::text,
    reference_id text DEFAULT ''::text,
    currency_code text DEFAULT 'INR'::text,
    exchange_rate_snapshot numeric(18,6) DEFAULT '1'::numeric,
    subtotal_amount numeric(18,2) DEFAULT '0'::numeric,
    shipping_amount numeric(18,2) DEFAULT '0'::numeric,
    adjustment_amount numeric(18,2) DEFAULT '0'::numeric,
    total_amount numeric(18,2) DEFAULT '0'::numeric,
    invoice_currency_amount numeric(18,2) DEFAULT '0'::numeric,
    base_currency_amount numeric(18,2) DEFAULT '0'::numeric,
    received_amount numeric(18,2) DEFAULT '0'::numeric,
    pending_amount numeric(18,2) DEFAULT '0'::numeric,
    remarks text DEFAULT ''::text,
    created_by text DEFAULT ''::text,
    shipping_address text DEFAULT ''::text,
    carrier text DEFAULT ''::text,
    tracking_number text DEFAULT ''::text,
    dispatch_date text DEFAULT ''::text,
    expected_delivery text DEFAULT ''::text
);


ALTER TABLE public.invoices OWNER TO neondb_owner;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO neondb_owner;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: item_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.item_types (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.item_types OWNER TO neondb_owner;

--
-- Name: item_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.item_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_types_id_seq OWNER TO neondb_owner;

--
-- Name: item_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.item_types_id_seq OWNED BY public.item_types.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.items (
    id integer NOT NULL,
    item_code text NOT NULL,
    item_name text NOT NULL,
    item_type text DEFAULT ''::text NOT NULL,
    description text,
    unit_type text DEFAULT ''::text NOT NULL,
    unit_price text DEFAULT '0'::text NOT NULL,
    hsn_code text,
    gst_percent text,
    current_stock text DEFAULT '0'::text NOT NULL,
    location_stocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    reorder_level numeric(14,3),
    minimum_level numeric(14,3),
    maximum_level numeric(14,3),
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.items OWNER TO neondb_owner;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO neondb_owner;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: material_reservations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.material_reservations (
    id integer NOT NULL,
    item_id integer NOT NULL,
    inventory_id integer NOT NULL,
    reservation_type text NOT NULL,
    reference_id integer NOT NULL,
    reserved_quantity numeric(14,3) NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    remarks text,
    reserved_by text,
    reservation_date text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.material_reservations OWNER TO neondb_owner;

--
-- Name: material_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.material_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.material_reservations_id_seq OWNER TO neondb_owner;

--
-- Name: material_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.material_reservations_id_seq OWNED BY public.material_reservations.id;


--
-- Name: materials; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.materials (
    id integer NOT NULL,
    material_code text NOT NULL,
    item_type text DEFAULT ''::text NOT NULL,
    quality text NOT NULL,
    type text,
    color text,
    hex_code text,
    color_name text NOT NULL,
    size text NOT NULL,
    unit_price text NOT NULL,
    unit_type text NOT NULL,
    current_stock text NOT NULL,
    hsn_code text NOT NULL,
    gst_percent text NOT NULL,
    vendor text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    reorder_level numeric(14,3),
    minimum_level numeric(14,3),
    maximum_level numeric(14,3),
    material_name text,
    location_stocks jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.materials OWNER TO neondb_owner;

--
-- Name: materials_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.materials_id_seq OWNER TO neondb_owner;

--
-- Name: materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.materials_id_seq OWNED BY public.materials.id;


--
-- Name: order_shipping_details; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.order_shipping_details (
    id integer NOT NULL,
    reference_type text NOT NULL,
    reference_id integer NOT NULL,
    client_name text,
    shipping_vendor_id integer,
    tracking_number text,
    tracking_url text,
    shipment_weight numeric(12,4) DEFAULT '0'::numeric NOT NULL,
    rate_per_kg numeric(12,4) DEFAULT '0'::numeric NOT NULL,
    calculated_shipping_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    manual_shipping_amount_override numeric(12,2),
    final_shipping_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    shipment_status text DEFAULT 'Pending'::text NOT NULL,
    shipment_date date,
    expected_delivery_date date,
    actual_delivery_date date,
    remarks text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_shipping_details_reference_type_check CHECK ((reference_type = ANY (ARRAY['Swatch'::text, 'Style'::text, 'PackingList'::text])))
);


ALTER TABLE public.order_shipping_details OWNER TO neondb_owner;

--
-- Name: order_shipping_details_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.order_shipping_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_shipping_details_id_seq OWNER TO neondb_owner;

--
-- Name: order_shipping_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.order_shipping_details_id_seq OWNED BY public.order_shipping_details.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_id text NOT NULL,
    order_type text NOT NULL,
    client text NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    assigned_to text,
    delivery_date text,
    remarks text,
    production_mode text DEFAULT 'in-house'::text NOT NULL,
    cost_status text DEFAULT 'Pending'::text NOT NULL,
    approval_status text DEFAULT 'Pending'::text NOT NULL,
    invoice_status text DEFAULT 'Not Issued'::text NOT NULL,
    invoice_number text,
    payment_status text DEFAULT 'Unpaid'::text NOT NULL,
    fabric text,
    swatch_length text,
    swatch_width text,
    quantity text,
    reference_swatch_id text,
    reference_style_id text,
    product text,
    pattern text,
    size_breakdown text,
    color_variants text,
    materials text,
    consumption text,
    artisan_assignment text,
    outsource_assignment text,
    artwork_hours text,
    artwork_rate text,
    artwork_feedback text,
    material_cost text,
    artisan_cost text,
    outsource_cost text,
    custom_charges text,
    total_cost text,
    client_comments text,
    share_link text,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: other_expenses; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.other_expenses (
    expense_id integer NOT NULL,
    expense_number text NOT NULL,
    expense_category text NOT NULL,
    vendor_id integer,
    vendor_name text DEFAULT ''::text,
    reference_type text DEFAULT 'Manual'::text,
    reference_id text DEFAULT ''::text,
    amount numeric(18,2) NOT NULL,
    currency_code text DEFAULT 'INR'::text NOT NULL,
    payment_status text DEFAULT 'Unpaid'::text NOT NULL,
    payment_type text DEFAULT ''::text,
    paid_amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    expense_date text NOT NULL,
    remarks text DEFAULT ''::text,
    attachment text DEFAULT ''::text,
    created_by text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.other_expenses OWNER TO neondb_owner;

--
-- Name: other_expenses_expense_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.other_expenses_expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.other_expenses_expense_id_seq OWNER TO neondb_owner;

--
-- Name: other_expenses_expense_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.other_expenses_expense_id_seq OWNED BY public.other_expenses.expense_id;


--
-- Name: outsource_jobs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.outsource_jobs (
    id integer NOT NULL,
    swatch_order_id integer,
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    hsn_id integer NOT NULL,
    hsn_code text NOT NULL,
    gst_percentage text DEFAULT '5'::text NOT NULL,
    issue_date text NOT NULL,
    target_date text,
    delivery_date text,
    total_cost text DEFAULT '0'::text NOT NULL,
    notes text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    style_order_id integer,
    style_order_product_id integer,
    style_order_product_name text
);


ALTER TABLE public.outsource_jobs OWNER TO neondb_owner;

--
-- Name: outsource_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.outsource_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outsource_jobs_id_seq OWNER TO neondb_owner;

--
-- Name: outsource_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.outsource_jobs_id_seq OWNED BY public.outsource_jobs.id;


--
-- Name: packaging_materials; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packaging_materials (
    id integer NOT NULL,
    item_name text NOT NULL,
    department text,
    size text,
    unit_type text,
    unit_price numeric(12,2),
    vendor text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    item_code text NOT NULL,
    item_type text,
    current_stock numeric(14,3) DEFAULT '0'::numeric,
    reorder_level numeric(14,3),
    minimum_level numeric(14,3),
    maximum_level numeric(14,3)
);


ALTER TABLE public.packaging_materials OWNER TO neondb_owner;

--
-- Name: packaging_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.packaging_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packaging_materials_id_seq OWNER TO neondb_owner;

--
-- Name: packaging_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.packaging_materials_id_seq OWNED BY public.packaging_materials.id;


--
-- Name: packing_list_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packing_list_items (
    id integer NOT NULL,
    packing_list_id integer NOT NULL,
    item_type text NOT NULL,
    item_id integer NOT NULL,
    order_code text,
    description text,
    qty numeric(12,3),
    unit text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_kg numeric(10,3),
    item_image_url text
);


ALTER TABLE public.packing_list_items OWNER TO neondb_owner;

--
-- Name: packing_list_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.packing_list_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packing_list_items_id_seq OWNER TO neondb_owner;

--
-- Name: packing_list_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.packing_list_items_id_seq OWNED BY public.packing_list_items.id;


--
-- Name: packing_lists; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packing_lists (
    id integer NOT NULL,
    pl_number text NOT NULL,
    client_id integer NOT NULL,
    delivery_address_id integer,
    shipment_id integer,
    destination_country text,
    package_count integer,
    package_type text,
    dimensions text,
    net_weight numeric(12,3),
    gross_weight numeric(12,3),
    status text DEFAULT 'Draft'::text NOT NULL,
    remarks text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.packing_lists OWNER TO neondb_owner;

--
-- Name: packing_lists_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.packing_lists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packing_lists_id_seq OWNER TO neondb_owner;

--
-- Name: packing_lists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.packing_lists_id_seq OWNED BY public.packing_lists.id;


--
-- Name: packing_package_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packing_package_items (
    id integer NOT NULL,
    package_id integer NOT NULL,
    order_type text NOT NULL,
    order_id integer NOT NULL,
    product_id integer,
    order_code text,
    description text,
    quantity numeric(12,3),
    unit text,
    item_weight numeric(10,3),
    item_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.packing_package_items OWNER TO neondb_owner;

--
-- Name: packing_package_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.packing_package_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packing_package_items_id_seq OWNER TO neondb_owner;

--
-- Name: packing_package_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.packing_package_items_id_seq OWNED BY public.packing_package_items.id;


--
-- Name: packing_packages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packing_packages (
    id integer NOT NULL,
    packing_list_id integer NOT NULL,
    package_number integer NOT NULL,
    length numeric(10,2),
    width numeric(10,2),
    height numeric(10,2),
    net_weight numeric(12,3),
    gross_weight numeric(12,3),
    shipment_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.packing_packages OWNER TO neondb_owner;

--
-- Name: packing_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.packing_packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packing_packages_id_seq OWNER TO neondb_owner;

--
-- Name: packing_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.packing_packages_id_seq OWNED BY public.packing_packages.id;


--
-- Name: pr_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pr_payments (
    id integer NOT NULL,
    pr_id integer NOT NULL,
    payment_type text NOT NULL,
    payment_date timestamp with time zone DEFAULT now() NOT NULL,
    payment_mode text DEFAULT ''::text NOT NULL,
    amount text NOT NULL,
    transaction_status text DEFAULT ''::text NOT NULL,
    payment_status text DEFAULT 'Pending'::text NOT NULL,
    attachment jsonb DEFAULT 'null'::jsonb,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.pr_payments OWNER TO neondb_owner;

--
-- Name: pr_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pr_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pr_payments_id_seq OWNER TO neondb_owner;

--
-- Name: pr_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pr_payments_id_seq OWNED BY public.pr_payments.id;


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_order_items (
    id integer NOT NULL,
    po_id integer NOT NULL,
    inventory_item_id integer,
    item_name text NOT NULL,
    item_code text DEFAULT ''::text NOT NULL,
    ordered_quantity numeric(14,3) NOT NULL,
    received_quantity numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    unit_price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    warehouse_location text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    item_image text
);


ALTER TABLE public.purchase_order_items OWNER TO neondb_owner;

--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.purchase_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_order_items_id_seq OWNER TO neondb_owner;

--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.purchase_order_items_id_seq OWNED BY public.purchase_order_items.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    po_number text NOT NULL,
    swatch_order_id integer,
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    po_date timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    notes text,
    bom_row_ids jsonb DEFAULT '[]'::jsonb,
    approved_by text,
    approved_at timestamp with time zone,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    bom_items jsonb DEFAULT '[]'::jsonb,
    style_order_id integer,
    reference_type text DEFAULT 'Manual'::text NOT NULL,
    reference_id integer
);


ALTER TABLE public.purchase_orders OWNER TO neondb_owner;

--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_orders_id_seq OWNER TO neondb_owner;

--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: purchase_receipt_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_receipt_items (
    id integer NOT NULL,
    pr_id integer NOT NULL,
    inventory_item_id integer NOT NULL,
    item_name text NOT NULL,
    item_code text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    warehouse_location text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    po_item_id integer,
    item_image text
);


ALTER TABLE public.purchase_receipt_items OWNER TO neondb_owner;

--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.purchase_receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNER TO neondb_owner;

--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNED BY public.purchase_receipt_items.id;


--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.purchase_receipts (
    id integer NOT NULL,
    pr_number text NOT NULL,
    po_id integer NOT NULL,
    swatch_order_id integer,
    vendor_name text NOT NULL,
    received_date timestamp with time zone DEFAULT now() NOT NULL,
    received_qty text NOT NULL,
    actual_price text NOT NULL,
    warehouse_location text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    bom_row_id integer,
    style_order_id integer,
    vendor_invoice_number text,
    vendor_invoice_date date,
    vendor_invoice_amount numeric(12,2),
    vendor_invoice_file text,
    vendor_invoice_uploaded_at timestamp with time zone
);


ALTER TABLE public.purchase_receipts OWNER TO neondb_owner;

--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.purchase_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_receipts_id_seq OWNER TO neondb_owner;

--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.purchase_receipts_id_seq OWNED BY public.purchase_receipts.id;


--
-- Name: quotation_custom_charges; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quotation_custom_charges (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    charge_name text NOT NULL,
    hsn_code text,
    unit text,
    quantity numeric(14,3) DEFAULT '1'::numeric,
    price numeric(14,2) DEFAULT '0'::numeric,
    amount numeric(14,2) DEFAULT '0'::numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotation_custom_charges OWNER TO neondb_owner;

--
-- Name: quotation_custom_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quotation_custom_charges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_custom_charges_id_seq OWNER TO neondb_owner;

--
-- Name: quotation_custom_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quotation_custom_charges_id_seq OWNED BY public.quotation_custom_charges.id;


--
-- Name: quotation_designs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quotation_designs (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    design_name text NOT NULL,
    hsn_code text,
    design_image text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotation_designs OWNER TO neondb_owner;

--
-- Name: quotation_designs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quotation_designs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_designs_id_seq OWNER TO neondb_owner;

--
-- Name: quotation_designs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quotation_designs_id_seq OWNED BY public.quotation_designs.id;


--
-- Name: quotation_feedback_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quotation_feedback_logs (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    feedback_text text NOT NULL,
    feedback_by text,
    feedback_date text NOT NULL,
    revision_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotation_feedback_logs OWNER TO neondb_owner;

--
-- Name: quotation_feedback_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quotation_feedback_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_feedback_logs_id_seq OWNER TO neondb_owner;

--
-- Name: quotation_feedback_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quotation_feedback_logs_id_seq OWNED BY public.quotation_feedback_logs.id;


--
-- Name: quotation_number_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quotation_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotation_number_seq OWNER TO neondb_owner;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.quotations (
    id integer NOT NULL,
    quotation_number text NOT NULL,
    client_id integer,
    client_name text,
    client_state text,
    requirement_summary text,
    estimated_weight numeric(10,3) DEFAULT '0'::numeric,
    estimated_shipping_charges numeric(14,2) DEFAULT '0'::numeric,
    subtotal_amount numeric(14,2) DEFAULT '0'::numeric,
    gst_type text DEFAULT 'IGST'::text,
    gst_rate numeric(5,2) DEFAULT '18'::numeric,
    gst_amount numeric(14,2) DEFAULT '0'::numeric,
    total_amount numeric(14,2) DEFAULT '0'::numeric,
    status text DEFAULT 'Draft'::text NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    parent_quotation_id integer,
    internal_notes text,
    client_notes text,
    converted_to text,
    converted_reference_id text,
    converted_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_page text DEFAULT 'classic'::text NOT NULL,
    cover_page_image text
);


ALTER TABLE public.quotations OWNER TO neondb_owner;

--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotations_id_seq OWNER TO neondb_owner;

--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.quotations_id_seq OWNED BY public.quotations.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO neondb_owner;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO neondb_owner;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO neondb_owner;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO neondb_owner;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: shipping_vendors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.shipping_vendors (
    id integer NOT NULL,
    vendor_name text NOT NULL,
    contact_person text,
    phone_number text,
    email_address text,
    weight_rate_per_kg numeric(12,4) DEFAULT '0'::numeric NOT NULL,
    minimum_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shipping_vendors OWNER TO neondb_owner;

--
-- Name: shipping_vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.shipping_vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shipping_vendors_id_seq OWNER TO neondb_owner;

--
-- Name: shipping_vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.shipping_vendors_id_seq OWNED BY public.shipping_vendors.id;


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_adjustments (
    id integer NOT NULL,
    item_id integer NOT NULL,
    inventory_id integer NOT NULL,
    adjustment_type text NOT NULL,
    adjustment_direction text NOT NULL,
    adjustment_quantity numeric(14,3) NOT NULL,
    unit text,
    average_price_at_adjustment numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    revenue_loss_amount numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    reference_type text DEFAULT 'Manual'::text NOT NULL,
    reference_id text,
    reason text,
    remarks text,
    adjusted_by text,
    adjustment_date text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_adjustments OWNER TO neondb_owner;

--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.stock_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_adjustments_id_seq OWNER TO neondb_owner;

--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.stock_adjustments_id_seq OWNED BY public.stock_adjustments.id;


--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_ledger (
    id integer NOT NULL,
    item_id integer NOT NULL,
    transaction_type text NOT NULL,
    reference_number text,
    reference_type text,
    in_quantity numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    out_quantity numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    balance_quantity numeric(14,3) DEFAULT '0'::numeric NOT NULL,
    remarks text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_ledger OWNER TO neondb_owner;

--
-- Name: stock_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.stock_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_ledger_id_seq OWNER TO neondb_owner;

--
-- Name: stock_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.stock_ledger_id_seq OWNED BY public.stock_ledger.id;


--
-- Name: style_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.style_categories (
    id integer NOT NULL,
    category_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.style_categories OWNER TO neondb_owner;

--
-- Name: style_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.style_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.style_categories_id_seq OWNER TO neondb_owner;

--
-- Name: style_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.style_categories_id_seq OWNED BY public.style_categories.id;


--
-- Name: style_order_artworks; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.style_order_artworks (
    id integer NOT NULL,
    artwork_code text NOT NULL,
    style_order_id integer NOT NULL,
    style_order_product_id integer,
    style_order_product_name text,
    artwork_name text NOT NULL,
    unit_length text,
    unit_width text,
    unit_type text,
    artwork_created text DEFAULT 'Inhouse'::text NOT NULL,
    work_hours text,
    hourly_rate text,
    total_cost text,
    outsource_vendor_id text,
    outsource_vendor_name text,
    outsource_payment_date text,
    outsource_payment_amount text,
    outsource_payment_mode text,
    outsource_transaction_id text,
    outsource_payment_status text,
    feedback_status text DEFAULT 'Pending'::text NOT NULL,
    files jsonb DEFAULT '[]'::jsonb,
    ref_images jsonb DEFAULT '[]'::jsonb,
    wip_images jsonb DEFAULT '[]'::jsonb,
    final_images jsonb DEFAULT '[]'::jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    toile_making_cost text,
    toile_vendor_id text,
    toile_vendor_name text,
    toile_cost text,
    toile_payment_date text,
    toile_payment_mode text,
    toile_payment_status text,
    toile_transaction_id text,
    toile_images jsonb DEFAULT '[]'::jsonb,
    pattern_type text,
    pattern_making_cost text,
    pattern_doc jsonb DEFAULT '[]'::jsonb,
    pattern_outhouse_doc jsonb DEFAULT '[]'::jsonb,
    toile_payment_type text,
    toile_payment_amount text,
    toile_remarks text,
    pattern_vendor_id text,
    pattern_vendor_name text,
    pattern_payment_type text,
    pattern_payment_mode text,
    pattern_payment_status text,
    pattern_payment_amount text,
    pattern_transaction_id text,
    pattern_payment_date text,
    pattern_remarks text,
    videos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.style_order_artworks OWNER TO neondb_owner;

--
-- Name: style_order_artworks_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.style_order_artworks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.style_order_artworks_id_seq OWNER TO neondb_owner;

--
-- Name: style_order_artworks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.style_order_artworks_id_seq OWNED BY public.style_order_artworks.id;


--
-- Name: style_order_products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.style_order_products (
    id integer NOT NULL,
    style_order_id integer NOT NULL,
    product_name text NOT NULL,
    style_category_id text,
    style_category_name text,
    product_status text DEFAULT 'Draft'::text NOT NULL,
    fabric_id text,
    fabric_name text,
    has_lining boolean DEFAULT false NOT NULL,
    lining_fabric_id text,
    lining_fabric_name text,
    unit_length text,
    unit_width text,
    unit_type text,
    order_issue_date text,
    delivery_date text,
    target_hours text,
    issued_to text,
    department text,
    ref_docs jsonb DEFAULT '[]'::jsonb,
    ref_images jsonb DEFAULT '[]'::jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    pattern_type text,
    pattern_making_cost text,
    pattern_doc jsonb DEFAULT '[]'::jsonb,
    pattern_outhouse_doc jsonb DEFAULT '[]'::jsonb,
    pattern_vendor_id text,
    pattern_vendor_name text,
    pattern_payment_type text,
    pattern_payment_mode text,
    pattern_payment_status text DEFAULT 'Pending'::text,
    pattern_payment_amount text,
    pattern_transaction_id text,
    pattern_payment_date text,
    pattern_remarks text,
    videos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.style_order_products OWNER TO neondb_owner;

--
-- Name: style_order_products_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.style_order_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.style_order_products_id_seq OWNER TO neondb_owner;

--
-- Name: style_order_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.style_order_products_id_seq OWNED BY public.style_order_products.id;


--
-- Name: style_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.style_orders (
    id integer NOT NULL,
    order_code text NOT NULL,
    style_name text NOT NULL,
    style_no text,
    client_id text,
    client_name text,
    quantity text,
    priority text DEFAULT 'Medium'::text NOT NULL,
    order_status text DEFAULT 'Draft'::text NOT NULL,
    season text,
    colorway text,
    sample_size text,
    fabric_type text,
    order_issue_date text,
    delivery_date text,
    target_hours text,
    issued_to text,
    department text,
    description text,
    internal_notes text,
    client_instructions text,
    is_chargeable boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    actual_start_date text,
    actual_start_time text,
    tentative_delivery_date text,
    actual_completion_date text,
    actual_completion_time text,
    delay_reason text,
    approval_date text,
    revision_count integer DEFAULT 0 NOT NULL,
    style_references jsonb DEFAULT '[]'::jsonb,
    swatch_references jsonb DEFAULT '[]'::jsonb,
    ref_docs jsonb DEFAULT '[]'::jsonb,
    ref_images jsonb DEFAULT '[]'::jsonb,
    estimate jsonb DEFAULT '[]'::jsonb,
    delivery_address_id integer,
    is_inhouse boolean DEFAULT false NOT NULL,
    wip_images jsonb DEFAULT '[]'::jsonb,
    final_images jsonb DEFAULT '[]'::jsonb,
    wip_videos jsonb DEFAULT '[]'::jsonb,
    final_videos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.style_orders OWNER TO neondb_owner;

--
-- Name: style_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.style_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.style_orders_id_seq OWNER TO neondb_owner;

--
-- Name: style_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.style_orders_id_seq OWNED BY public.style_orders.id;


--
-- Name: styles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.styles (
    id integer NOT NULL,
    client text NOT NULL,
    style_no text NOT NULL,
    invoice_no text,
    description text,
    attach_link text,
    place_of_issue text,
    vendor_po_no text,
    shipping_date text,
    style_category text NOT NULL,
    reference_swatch_id text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    wip_media jsonb DEFAULT '[]'::jsonb,
    final_media jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.styles OWNER TO neondb_owner;

--
-- Name: styles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.styles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.styles_id_seq OWNER TO neondb_owner;

--
-- Name: styles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.styles_id_seq OWNED BY public.styles.id;


--
-- Name: swatch_bom; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.swatch_bom (
    id integer NOT NULL,
    swatch_order_id integer,
    material_type text NOT NULL,
    material_id integer NOT NULL,
    material_code text NOT NULL,
    material_name text NOT NULL,
    current_stock text DEFAULT '0'::text NOT NULL,
    avg_unit_price text DEFAULT '0'::text NOT NULL,
    unit_type text DEFAULT ''::text NOT NULL,
    warehouse_location text DEFAULT ''::text NOT NULL,
    required_qty text NOT NULL,
    estimated_amount text DEFAULT '0'::text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    consumed_qty text DEFAULT '0'::text NOT NULL,
    style_order_id integer,
    target_vendor_id integer,
    target_vendor_name text
);


ALTER TABLE public.swatch_bom OWNER TO neondb_owner;

--
-- Name: swatch_bom_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.swatch_bom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.swatch_bom_id_seq OWNER TO neondb_owner;

--
-- Name: swatch_bom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.swatch_bom_id_seq OWNED BY public.swatch_bom.id;


--
-- Name: swatch_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.swatch_categories (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text,
    updated_at timestamp with time zone
);


ALTER TABLE public.swatch_categories OWNER TO neondb_owner;

--
-- Name: swatch_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.swatch_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.swatch_categories_id_seq OWNER TO neondb_owner;

--
-- Name: swatch_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.swatch_categories_id_seq OWNED BY public.swatch_categories.id;


--
-- Name: swatch_orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.swatch_orders (
    id integer NOT NULL,
    order_code text NOT NULL,
    swatch_name text NOT NULL,
    client_id text,
    client_name text,
    is_chargeable boolean DEFAULT false NOT NULL,
    quantity text,
    priority text DEFAULT 'Medium'::text NOT NULL,
    order_status text DEFAULT 'Draft'::text NOT NULL,
    style_references jsonb DEFAULT '[]'::jsonb,
    swatch_references jsonb DEFAULT '[]'::jsonb,
    fabric_id text,
    fabric_name text,
    has_lining boolean DEFAULT false NOT NULL,
    lining_fabric_id text,
    lining_fabric_name text,
    unit_length text,
    unit_width text,
    unit_type text,
    order_issue_date text,
    delivery_date text,
    target_hours text,
    issued_to text,
    department text,
    description text,
    internal_notes text,
    client_instructions text,
    ref_docs jsonb DEFAULT '[]'::jsonb,
    ref_images jsonb DEFAULT '[]'::jsonb,
    actual_start_date text,
    actual_start_time text,
    tentative_delivery_date text,
    actual_completion_date text,
    actual_completion_time text,
    delay_reason text,
    approval_date text,
    revision_count integer DEFAULT 0 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    estimate jsonb DEFAULT '[]'::jsonb,
    delivery_address_id integer,
    is_inhouse boolean DEFAULT false NOT NULL,
    wip_images jsonb DEFAULT '[]'::jsonb,
    final_images jsonb DEFAULT '[]'::jsonb,
    wip_videos jsonb DEFAULT '[]'::jsonb,
    final_videos jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.swatch_orders OWNER TO neondb_owner;

--
-- Name: swatch_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.swatch_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.swatch_orders_id_seq OWNER TO neondb_owner;

--
-- Name: swatch_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.swatch_orders_id_seq OWNED BY public.swatch_orders.id;


--
-- Name: swatches; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.swatches (
    id integer NOT NULL,
    swatch_code text NOT NULL,
    swatch_name text NOT NULL,
    fabric text,
    color_name text,
    hex_code text,
    width text,
    unit_type text,
    finish_type text,
    gsm text,
    client text,
    approval_status text DEFAULT 'Pending'::text NOT NULL,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    swatch_category text,
    location text,
    swatch_date text,
    length text,
    hours text,
    attachments jsonb DEFAULT '[]'::jsonb,
    wip_media jsonb DEFAULT '[]'::jsonb,
    final_media jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.swatches OWNER TO neondb_owner;

--
-- Name: swatches_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.swatches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.swatches_id_seq OWNER TO neondb_owner;

--
-- Name: swatches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.swatches_id_seq OWNED BY public.swatches.id;


--
-- Name: unit_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.unit_types (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.unit_types OWNER TO neondb_owner;

--
-- Name: unit_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.unit_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.unit_types_id_seq OWNER TO neondb_owner;

--
-- Name: unit_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.unit_types_id_seq OWNED BY public.unit_types.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    hashed_password text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invite_token text,
    invite_token_expiry timestamp with time zone,
    phone_number text,
    profile_photo text
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vendor_invoice_ledger; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_invoice_ledger (
    id integer NOT NULL,
    vendor_id integer NOT NULL,
    vendor_name text,
    purchase_receipt_id integer NOT NULL,
    pr_number text NOT NULL,
    vendor_invoice_number text NOT NULL,
    vendor_invoice_date date,
    vendor_invoice_amount numeric(12,2) NOT NULL,
    entry_type text DEFAULT 'Vendor Invoice'::text NOT NULL,
    status text DEFAULT 'Unpaid'::text NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    paid_amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    pending_amount numeric(18,2) GENERATED ALWAYS AS ((vendor_invoice_amount - paid_amount)) STORED,
    linked_po_number text DEFAULT ''::text
);


ALTER TABLE public.vendor_invoice_ledger OWNER TO neondb_owner;

--
-- Name: vendor_invoice_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendor_invoice_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_invoice_ledger_id_seq OWNER TO neondb_owner;

--
-- Name: vendor_invoice_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendor_invoice_ledger_id_seq OWNED BY public.vendor_invoice_ledger.id;


--
-- Name: vendor_ledger_charges; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_ledger_charges (
    id integer NOT NULL,
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    charge_date timestamp with time zone DEFAULT now() NOT NULL,
    description text NOT NULL,
    amount text NOT NULL,
    notes text,
    order_type text DEFAULT 'general'::text NOT NULL,
    style_order_id integer,
    style_order_code text,
    swatch_order_id integer,
    swatch_order_code text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_ledger_charges OWNER TO neondb_owner;

--
-- Name: vendor_ledger_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendor_ledger_charges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_ledger_charges_id_seq OWNER TO neondb_owner;

--
-- Name: vendor_ledger_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendor_ledger_charges_id_seq OWNED BY public.vendor_ledger_charges.id;


--
-- Name: vendor_payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_payments (
    id integer NOT NULL,
    vendor_id integer NOT NULL,
    vendor_name text NOT NULL,
    payment_date timestamp with time zone DEFAULT now() NOT NULL,
    amount text NOT NULL,
    payment_mode text DEFAULT 'Bank Transfer'::text NOT NULL,
    reference_no text,
    notes text,
    order_type text DEFAULT 'general'::text NOT NULL,
    style_order_id integer,
    style_order_code text,
    swatch_order_id integer,
    swatch_order_code text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_payments OWNER TO neondb_owner;

--
-- Name: vendor_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendor_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendor_payments_id_seq OWNER TO neondb_owner;

--
-- Name: vendor_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendor_payments_id_seq OWNED BY public.vendor_payments.id;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendors (
    id integer NOT NULL,
    vendor_code text NOT NULL,
    brand_name text NOT NULL,
    contact_name text NOT NULL,
    email text,
    alt_email text,
    contact_no text,
    alt_contact_no text,
    has_gst boolean DEFAULT false NOT NULL,
    gst_no text,
    bank_name text,
    account_no text,
    ifsc_code text,
    address1 text,
    address2 text,
    country text,
    state text,
    city text,
    pincode text,
    is_active boolean DEFAULT true NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    updated_at timestamp with time zone,
    bank_accounts jsonb,
    payment_attachments jsonb,
    addresses jsonb
);


ALTER TABLE public.vendors OWNER TO neondb_owner;

--
-- Name: vendors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vendors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vendors_id_seq OWNER TO neondb_owner;

--
-- Name: vendors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vendors_id_seq OWNED BY public.vendors.id;


--
-- Name: warehouse_locations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.warehouse_locations (
    id integer NOT NULL,
    name text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    address_line1 text DEFAULT ''::text NOT NULL,
    address_line2 text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    state text DEFAULT ''::text NOT NULL,
    pincode text DEFAULT ''::text NOT NULL,
    country text DEFAULT 'India'::text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    contact_phone text DEFAULT ''::text NOT NULL,
    contact_email text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.warehouse_locations OWNER TO neondb_owner;

--
-- Name: warehouse_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.warehouse_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warehouse_locations_id_seq OWNER TO neondb_owner;

--
-- Name: warehouse_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.warehouse_locations_id_seq OWNED BY public.warehouse_locations.id;


--
-- Name: width_unit_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.width_unit_types (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.width_unit_types OWNER TO neondb_owner;

--
-- Name: width_unit_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.width_unit_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.width_unit_types_id_seq OWNER TO neondb_owner;

--
-- Name: width_unit_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.width_unit_types_id_seq OWNED BY public.width_unit_types.id;


--
-- Name: replit_database_migrations_v1 id; Type: DEFAULT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1 ALTER COLUMN id SET DEFAULT nextval('_system.replit_database_migrations_v1_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: artisan_timesheets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.artisan_timesheets ALTER COLUMN id SET DEFAULT nextval('public.artisan_timesheets_id_seq'::regclass);


--
-- Name: artworks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.artworks ALTER COLUMN id SET DEFAULT nextval('public.artworks_id_seq'::regclass);


--
-- Name: bank_accounts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bank_accounts ALTER COLUMN id SET DEFAULT nextval('public.bank_accounts_id_seq'::regclass);


--
-- Name: bom_change_log id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bom_change_log ALTER COLUMN id SET DEFAULT nextval('public.bom_change_log_id_seq'::regclass);


--
-- Name: client_feedback id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_feedback ALTER COLUMN id SET DEFAULT nextval('public.client_feedback_id_seq'::regclass);


--
-- Name: client_invoice_ledger id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_invoice_ledger ALTER COLUMN id SET DEFAULT nextval('public.client_invoice_ledger_id_seq'::regclass);


--
-- Name: client_links id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_links ALTER COLUMN id SET DEFAULT nextval('public.client_links_id_seq'::regclass);


--
-- Name: client_messages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_messages ALTER COLUMN id SET DEFAULT nextval('public.client_messages_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: company_gst_settings gst_settings_id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_gst_settings ALTER COLUMN gst_settings_id SET DEFAULT nextval('public.company_gst_settings_gst_settings_id_seq'::regclass);


--
-- Name: consumption_log id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consumption_log ALTER COLUMN id SET DEFAULT nextval('public.consumption_log_id_seq'::regclass);


--
-- Name: costing_payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.costing_payments ALTER COLUMN id SET DEFAULT nextval('public.costing_payments_id_seq'::regclass);


--
-- Name: credit_debit_notes note_id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.credit_debit_notes ALTER COLUMN note_id SET DEFAULT nextval('public.credit_debit_notes_note_id_seq'::regclass);


--
-- Name: custom_charges id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_charges ALTER COLUMN id SET DEFAULT nextval('public.custom_charges_id_seq'::regclass);


--
-- Name: delivery_addresses id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.delivery_addresses ALTER COLUMN id SET DEFAULT nextval('public.delivery_addresses_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: download_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.download_logs ALTER COLUMN id SET DEFAULT nextval('public.download_logs_id_seq'::regclass);


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);


--
-- Name: fabric_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabric_types ALTER COLUMN id SET DEFAULT nextval('public.fabric_types_id_seq'::regclass);


--
-- Name: fabrics id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabrics ALTER COLUMN id SET DEFAULT nextval('public.fabrics_id_seq'::regclass);


--
-- Name: hsn_master id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hsn_master ALTER COLUMN id SET DEFAULT nextval('public.hsn_master_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: inventory_stock_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_stock_logs ALTER COLUMN id SET DEFAULT nextval('public.inventory_stock_logs_id_seq'::regclass);


--
-- Name: invoice_payments payment_id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_payments ALTER COLUMN payment_id SET DEFAULT nextval('public.invoice_payments_payment_id_seq'::regclass);


--
-- Name: invoice_templates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_templates ALTER COLUMN id SET DEFAULT nextval('public.invoice_templates_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: item_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.item_types ALTER COLUMN id SET DEFAULT nextval('public.item_types_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: material_reservations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_reservations ALTER COLUMN id SET DEFAULT nextval('public.material_reservations_id_seq'::regclass);


--
-- Name: materials id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials ALTER COLUMN id SET DEFAULT nextval('public.materials_id_seq'::regclass);


--
-- Name: order_shipping_details id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_shipping_details ALTER COLUMN id SET DEFAULT nextval('public.order_shipping_details_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: other_expenses expense_id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_expenses ALTER COLUMN expense_id SET DEFAULT nextval('public.other_expenses_expense_id_seq'::regclass);


--
-- Name: outsource_jobs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.outsource_jobs ALTER COLUMN id SET DEFAULT nextval('public.outsource_jobs_id_seq'::regclass);


--
-- Name: packaging_materials id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_materials ALTER COLUMN id SET DEFAULT nextval('public.packaging_materials_id_seq'::regclass);


--
-- Name: packing_list_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_list_items ALTER COLUMN id SET DEFAULT nextval('public.packing_list_items_id_seq'::regclass);


--
-- Name: packing_lists id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists ALTER COLUMN id SET DEFAULT nextval('public.packing_lists_id_seq'::regclass);


--
-- Name: packing_package_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_package_items ALTER COLUMN id SET DEFAULT nextval('public.packing_package_items_id_seq'::regclass);


--
-- Name: packing_packages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_packages ALTER COLUMN id SET DEFAULT nextval('public.packing_packages_id_seq'::regclass);


--
-- Name: pr_payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pr_payments ALTER COLUMN id SET DEFAULT nextval('public.pr_payments_id_seq'::regclass);


--
-- Name: purchase_order_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_order_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_items_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: purchase_receipt_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipt_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipt_items_id_seq'::regclass);


--
-- Name: purchase_receipts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipts ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipts_id_seq'::regclass);


--
-- Name: quotation_custom_charges id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_custom_charges ALTER COLUMN id SET DEFAULT nextval('public.quotation_custom_charges_id_seq'::regclass);


--
-- Name: quotation_designs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_designs ALTER COLUMN id SET DEFAULT nextval('public.quotation_designs_id_seq'::regclass);


--
-- Name: quotation_feedback_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_feedback_logs ALTER COLUMN id SET DEFAULT nextval('public.quotation_feedback_logs_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotations ALTER COLUMN id SET DEFAULT nextval('public.quotations_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: shipping_vendors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.shipping_vendors ALTER COLUMN id SET DEFAULT nextval('public.shipping_vendors_id_seq'::regclass);


--
-- Name: stock_adjustments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_adjustments ALTER COLUMN id SET DEFAULT nextval('public.stock_adjustments_id_seq'::regclass);


--
-- Name: stock_ledger id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_ledger ALTER COLUMN id SET DEFAULT nextval('public.stock_ledger_id_seq'::regclass);


--
-- Name: style_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_categories ALTER COLUMN id SET DEFAULT nextval('public.style_categories_id_seq'::regclass);


--
-- Name: style_order_artworks id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_order_artworks ALTER COLUMN id SET DEFAULT nextval('public.style_order_artworks_id_seq'::regclass);


--
-- Name: style_order_products id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_order_products ALTER COLUMN id SET DEFAULT nextval('public.style_order_products_id_seq'::regclass);


--
-- Name: style_orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_orders ALTER COLUMN id SET DEFAULT nextval('public.style_orders_id_seq'::regclass);


--
-- Name: styles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.styles ALTER COLUMN id SET DEFAULT nextval('public.styles_id_seq'::regclass);


--
-- Name: swatch_bom id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_bom ALTER COLUMN id SET DEFAULT nextval('public.swatch_bom_id_seq'::regclass);


--
-- Name: swatch_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_categories ALTER COLUMN id SET DEFAULT nextval('public.swatch_categories_id_seq'::regclass);


--
-- Name: swatch_orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_orders ALTER COLUMN id SET DEFAULT nextval('public.swatch_orders_id_seq'::regclass);


--
-- Name: swatches id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatches ALTER COLUMN id SET DEFAULT nextval('public.swatches_id_seq'::regclass);


--
-- Name: unit_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.unit_types ALTER COLUMN id SET DEFAULT nextval('public.unit_types_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vendor_invoice_ledger id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_invoice_ledger ALTER COLUMN id SET DEFAULT nextval('public.vendor_invoice_ledger_id_seq'::regclass);


--
-- Name: vendor_ledger_charges id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_ledger_charges ALTER COLUMN id SET DEFAULT nextval('public.vendor_ledger_charges_id_seq'::regclass);


--
-- Name: vendor_payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_payments ALTER COLUMN id SET DEFAULT nextval('public.vendor_payments_id_seq'::regclass);


--
-- Name: vendors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendors ALTER COLUMN id SET DEFAULT nextval('public.vendors_id_seq'::regclass);


--
-- Name: warehouse_locations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.warehouse_locations ALTER COLUMN id SET DEFAULT nextval('public.warehouse_locations_id_seq'::regclass);


--
-- Name: width_unit_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.width_unit_types ALTER COLUMN id SET DEFAULT nextval('public.width_unit_types_id_seq'::regclass);


--
-- Data for Name: replit_database_migrations_v1; Type: TABLE DATA; Schema: _system; Owner: neondb_owner
--

COPY _system.replit_database_migrations_v1 (id, build_id, deployment_id, statement_count, applied_at) FROM stdin;
1	f97cc744-31c6-419f-af94-bdc10f5c745d	f6c7d628-1e79-416c-978f-00b5fd6198ca	21	2026-04-14 12:59:36.437073+00
2	4ed2f12a-2bcf-4e40-a1fe-0ee2798b2170	f6c7d628-1e79-416c-978f-00b5fd6198ca	5	2026-04-15 07:26:49.83199+00
3	79b5435f-74d4-427a-bd9c-e193d3100bb3	f6c7d628-1e79-416c-978f-00b5fd6198ca	14	2026-04-15 14:10:24.633974+00
4	30dc21fc-1d5f-4a47-8736-2ecbf6e3a2d1	f6c7d628-1e79-416c-978f-00b5fd6198ca	5	2026-04-18 07:17:39.52752+00
5	91bc3b6c-f476-4673-902b-a78ea99be6a9	f6c7d628-1e79-416c-978f-00b5fd6198ca	1	2026-04-18 07:40:17.406748+00
6	1f208694-950c-4585-b915-8b6ff57d50c4	f6c7d628-1e79-416c-978f-00b5fd6198ca	3	2026-04-18 07:59:02.276268+00
7	a92b37f9-6c1f-4fab-ab79-9c4b4ef175c7	f6c7d628-1e79-416c-978f-00b5fd6198ca	11	2026-04-19 03:12:44.738752+00
8	c7cee200-eb1b-4d3a-9f34-bf7f9b90d53c	f6c7d628-1e79-416c-978f-00b5fd6198ca	22	2026-04-19 08:39:53.133365+00
9	872dc0b5-74a3-4b5f-82da-b4ab6e8e81fa	f6c7d628-1e79-416c-978f-00b5fd6198ca	36	2026-04-19 16:48:13.490081+00
10	95b53372-c709-413e-a089-89854c19126d	f6c7d628-1e79-416c-978f-00b5fd6198ca	5	2026-04-19 17:59:40.861382+00
11	9ed47a97-8c5a-40a9-bcd2-e3daadbe3230	f6c7d628-1e79-416c-978f-00b5fd6198ca	4	2026-04-20 02:21:49.971431+00
12	1dee757c-18d9-4f50-9fd3-acf0c57c72d5	f6c7d628-1e79-416c-978f-00b5fd6198ca	7	2026-04-20 03:48:35.975153+00
13	c9420397-3104-4dc1-b863-f62223cc4084	f6c7d628-1e79-416c-978f-00b5fd6198ca	11	2026-04-20 04:11:48.139299+00
14	b4a68119-87df-4aa0-aba9-c991fb31cda9	f6c7d628-1e79-416c-978f-00b5fd6198ca	16	2026-04-20 05:11:50.217509+00
15	fd1e4bea-ba0d-4082-b070-ecfea5ce6c87	f6c7d628-1e79-416c-978f-00b5fd6198ca	21	2026-04-20 11:44:07.115842+00
16	f66d8de7-40f8-4146-90e0-ed76b0768e61	f6c7d628-1e79-416c-978f-00b5fd6198ca	4	2026-04-20 18:06:28.867086+00
17	a2337e5f-cd37-4807-b508-981b56092943	f6c7d628-1e79-416c-978f-00b5fd6198ca	4	2026-04-25 06:45:11.569933+00
18	9753ad62-88ea-4b2a-a24f-604810c790dc	f6c7d628-1e79-416c-978f-00b5fd6198ca	14	2026-04-25 15:44:31.954844+00
19	a5d29e89-69bd-43b5-a67b-d4658b66cdc2	f6c7d628-1e79-416c-978f-00b5fd6198ca	2	2026-04-25 17:00:31.239043+00
20	2beb7cdf-756e-423c-9a63-e54b9a4ceeea	f6c7d628-1e79-416c-978f-00b5fd6198ca	27	2026-04-28 06:18:51.539097+00
21	a2428c4e-951d-4659-b6d3-09c8237f9fee	f6c7d628-1e79-416c-978f-00b5fd6198ca	2	2026-04-28 07:41:11.5513+00
22	7cef4517-f582-48c1-8e98-09794b38674a	f6c7d628-1e79-416c-978f-00b5fd6198ca	2	2026-04-29 14:01:30.294559+00
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.activity_logs (id, user_email, user_name, method, url, action, status_code, ip_address, created_at) FROM stdin;
1	anonymous		POST	/auth/login	Logged in	200	114.79.147.114	2026-04-20 03:49:57.254108+00
2	admin@zarierp.com	admin	POST	/style-bom	Created style bom	201	114.79.147.114	2026-04-20 03:53:11.899529+00
3	admin@zarierp.com	admin	POST	/style-bom	Created style bom	201	114.79.147.114	2026-04-20 03:53:25.965171+00
4	admin@zarierp.com	admin	GET	/client/download	Downloaded BOM PDF for Style Order ZST-2601 — House of Amore	200	114.79.147.114	2026-04-20 03:53:28.918223+00
5	admin@zarierp.com	admin	POST	/settings/activity-logs/action	Logged manual activity	200	114.79.147.114	2026-04-20 03:53:28.948034+00
6	admin@zarierp.com	admin	PUT	/settings/gst	Updated GST settings	200	114.79.147.114	2026-04-20 03:55:26.847472+00
7	admin@zarierp.com	admin	POST	/settings/exchange-rates/refresh	Refreshed all exchange rates from live market data	200	114.79.147.114	2026-04-20 03:57:45.428013+00
8	admin@zarierp.com	admin	POST	/settings/bank-accounts	Updated settings	201	114.79.147.114	2026-04-20 03:59:01.071922+00
9	admin@zarierp.com	admin	POST	/invoices	Created Invoice INV-2026-00001 for House of Amore — ₹2,950	201	114.79.147.114	2026-04-20 03:59:47.618094+00
10	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	201	114.79.147.114	2026-04-20 04:05:11.07831+00
11	admin@zarierp.com	admin	POST	/outsource-jobs	Created outsource jobs	201	114.79.147.114	2026-04-20 04:05:34.540471+00
12	admin@zarierp.com	admin	POST	/costing-payments	Created costing payments	201	114.79.147.114	2026-04-20 04:06:26.659606+00
13	admin@zarierp.com	admin	POST	/costing-payments	Created costing payments	201	114.79.147.114	2026-04-20 04:06:48.140005+00
14	admin@zarierp.com	admin	POST	/auth/logout	Logged out	200	114.79.147.114	2026-04-20 04:11:58.222408+00
15	anonymous		POST	/auth/login	Logged in	200	114.79.147.114	2026-04-20 04:12:20.695+00
16	admin@zarierp.com	admin	PUT	/invoices/1	Updated Invoice INV-2026-00001	200	114.79.147.114	2026-04-20 04:24:36.076784+00
17	admin@zarierp.com	admin	POST	/invoice-payments	Created invoice payments	200	114.79.147.114	2026-04-20 04:25:02.208144+00
18	anonymous		POST	/auth/login	Logged in	200	103.72.73.139	2026-04-21 10:27:47.861531+00
19	anonymous		POST	/auth/login	Logged in	200	38.130.146.190	2026-04-28 06:19:44.718347+00
20	admin@zarierp.com	admin	PUT	/swatch-orders/3	Updated Swatch Order #3	200	38.130.146.190	2026-04-28 06:24:11.834012+00
21	admin@zarierp.com	admin	POST	/bom	Created bom	201	38.130.146.190	2026-04-28 06:25:11.288942+00
22	admin@zarierp.com	admin	POST	/po	Created po	201	38.130.146.190	2026-04-28 06:26:17.524601+00
23	admin@zarierp.com	admin	PATCH	/po/1	Updated po	200	38.130.146.190	2026-04-28 06:26:22.362504+00
24	admin@zarierp.com	admin	PATCH	/po/1	Updated po	200	38.130.146.190	2026-04-28 06:26:25.073489+00
25	admin@zarierp.com	admin	GET	/client/download	Downloaded PO PDF PO-26-0001 for Swatch Order ZSW-0103 — Nila Threads	200	38.130.146.190	2026-04-28 06:26:29.574776+00
26	admin@zarierp.com	admin	POST	/settings/activity-logs/action	Logged manual activity	200	38.130.146.190	2026-04-28 06:26:29.603595+00
27	admin@zarierp.com	admin	POST	/settings/download-logs	Updated settings	200	38.130.146.190	2026-04-28 06:26:29.798222+00
28	admin@zarierp.com	admin	POST	/pr	Created pr	201	38.130.146.190	2026-04-28 06:27:29.047221+00
29	admin@zarierp.com	admin	POST	/pr	Created pr	201	38.130.146.190	2026-04-28 06:28:19.526602+00
30	admin@zarierp.com	admin	POST	/consumption	Created consumption	201	38.130.146.190	2026-04-28 06:29:44.58469+00
31	admin@zarierp.com	admin	POST	/consumption	Created consumption	201	38.130.146.190	2026-04-28 06:29:52.26494+00
32	admin@zarierp.com	admin	POST	/artisan-timesheets	Created artisan timesheets	201	38.130.146.190	2026-04-28 06:30:38.75452+00
33	admin@zarierp.com	admin	PUT	/swatch-orders/3	Updated Swatch Order #3	200	38.130.146.190	2026-04-28 06:32:00.956837+00
34	admin@zarierp.com	admin	POST	/quotations	Created Quotation QT-2026-00001 for House of Amore	200	38.130.146.190	2026-04-28 06:35:25.259029+00
35	admin@zarierp.com	admin	POST	/quotations	Created Quotation QT-2026-00002 for House of Amore	200	38.130.146.190	2026-04-28 06:35:27.996208+00
36	admin@zarierp.com	admin	GET	/client/download	Downloaded PDF for Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:35:31.449348+00
37	admin@zarierp.com	admin	POST	/settings/activity-logs/action	Logged manual activity	200	38.130.146.190	2026-04-28 06:35:31.485767+00
38	admin@zarierp.com	admin	POST	/settings/download-logs	Updated settings	200	38.130.146.190	2026-04-28 06:35:31.503135+00
39	admin@zarierp.com	admin	PUT	/quotations/2	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:35:45.65469+00
40	admin@zarierp.com	admin	PUT	/quotations/2	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:35:48.826975+00
41	admin@zarierp.com	admin	GET	/client/download	Downloaded PDF for Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:35:51.762234+00
42	admin@zarierp.com	admin	POST	/settings/activity-logs/action	Logged manual activity	200	38.130.146.190	2026-04-28 06:35:51.791144+00
43	admin@zarierp.com	admin	POST	/settings/download-logs	Updated settings	200	38.130.146.190	2026-04-28 06:35:51.797427+00
44	admin@zarierp.com	admin	PUT	/quotations/2	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:36:31.181268+00
45	admin@zarierp.com	admin	POST	/quotations/2/status	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:36:36.416742+00
46	admin@zarierp.com	admin	POST	/quotations/2/status	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:36:40.204942+00
47	admin@zarierp.com	admin	POST	/quotations/2/status	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:36:44.207429+00
48	admin@zarierp.com	admin	POST	/quotations/2/revise	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:36:46.728108+00
49	admin@zarierp.com	admin	PUT	/quotations/3	Updated Quotation QT-2026-00003 — House of Amore	200	38.130.146.190	2026-04-28 06:36:55.084119+00
50	admin@zarierp.com	admin	PUT	/quotations/3	Updated Quotation QT-2026-00003 — House of Amore	200	38.130.146.190	2026-04-28 06:36:57.473059+00
51	admin@zarierp.com	admin	POST	/quotations/2/status	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:37:26.48537+00
52	admin@zarierp.com	admin	POST	/quotations/3/status	Updated Quotation QT-2026-00003 — House of Amore	200	38.130.146.190	2026-04-28 06:37:57.392436+00
53	admin@zarierp.com	admin	POST	/quotations/2/status	Updated Quotation QT-2026-00002 — House of Amore	200	38.130.146.190	2026-04-28 06:38:31.160848+00
54	admin@zarierp.com	admin	POST	/quotations/2/convert-style	Converted Quotation to Style Order — QST-2026-00004	200	38.130.146.190	2026-04-28 06:38:37.056359+00
55	admin@zarierp.com	admin	PUT	/inventory/items/11/stock	Updated inventory item: Beads - Premium - Crystal Clear	200	38.130.146.190	2026-04-28 06:40:05.109828+00
56	admin@zarierp.com	admin	POST	/inventory/ledger/wastage	Updated inventory item #ledger	200	38.130.146.190	2026-04-28 06:41:46.303013+00
57	admin@zarierp.com	admin	PUT	/inventory/items/3/stock	Updated inventory item: Chanderi Silk - Standard - Champagne Beige	200	38.130.146.190	2026-04-28 06:42:08.95611+00
58	admin@zarierp.com	admin	PUT	/inventory/items/3/stock	Updated inventory item: Chanderi Silk - Standard - Champagne Beige	200	38.130.146.190	2026-04-28 06:42:23.139444+00
59	admin@zarierp.com	admin	PUT	/fabrics/2	Updated fabrics	200	38.130.146.190	2026-04-28 06:43:02.562163+00
60	admin@zarierp.com	admin	POST	/auth/logout	Logged out	200	38.130.146.190	2026-04-28 06:43:36.767767+00
61	anonymous		POST	/auth/login	Logged in	401	122.170.197.61	2026-04-28 07:00:32.200622+00
62	anonymous		POST	/auth/forgot-password	Authentication action	404	122.170.197.61	2026-04-28 07:01:12.494079+00
63	anonymous		POST	/auth/login	Logged in	200	122.170.197.61	2026-04-28 07:01:35.307823+00
64	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	201	122.170.197.61	2026-04-28 07:06:01.201868+00
65	admin@zarierp.com	admin	PUT	/hsn/2	Updated HSN Code #2	200	122.170.197.61	2026-04-28 07:06:14.868293+00
66	admin@zarierp.com	admin	PUT	/hsn/2	Updated HSN Code #2	200	122.170.197.61	2026-04-28 07:07:26.254528+00
67	admin@zarierp.com	admin	PATCH	/hsn/2/status	Updated HSN Code #2	200	122.170.197.61	2026-04-28 07:08:24.667617+00
68	admin@zarierp.com	admin	PATCH	/hsn/2/status	Updated HSN Code #2	200	122.170.197.61	2026-04-28 07:08:29.595984+00
69	admin@zarierp.com	admin	PATCH	/hsn/2/status	Updated HSN Code #2	200	122.170.197.61	2026-04-28 07:08:53.228853+00
70	admin@zarierp.com	admin	POST	/lookups/fabric-types	Created lookups → fabric types	201	122.170.197.61	2026-04-28 07:17:48.661724+00
71	admin@zarierp.com	admin	POST	/lookups/width-unit-types	Created lookups → width unit types	201	122.170.197.61	2026-04-28 07:19:17.078826+00
72	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	400	122.170.197.61	2026-04-28 07:19:59.808379+00
73	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	400	122.170.197.61	2026-04-28 07:20:30.380719+00
74	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	400	122.170.197.61	2026-04-28 07:20:36.302949+00
75	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	400	122.170.197.61	2026-04-28 07:20:41.115802+00
76	admin@zarierp.com	admin	POST	/hsn	Created HSN Code	201	122.170.197.61	2026-04-28 07:20:45.756349+00
77	admin@zarierp.com	admin	POST	/fabrics	Created fabrics	201	122.170.197.61	2026-04-28 07:24:16.400992+00
78	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:25:05.693922+00
79	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:25:33.394725+00
80	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:26:13.658407+00
81	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:26:34.115194+00
82	admin@zarierp.com	admin	POST	/fabrics/import	Created fabrics → import	200	122.170.197.61	2026-04-28 07:29:20.376588+00
83	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:31:38.484571+00
84	admin@zarierp.com	admin	PUT	/fabrics/9	Updated fabrics	200	122.170.197.61	2026-04-28 07:32:12.69799+00
85	admin@zarierp.com	admin	POST	/swatch-categories	Created swatch categories	201	122.170.197.61	2026-04-28 07:33:26.256403+00
86	admin@zarierp.com	admin	PATCH	/swatch-categories/1/status	Updated swatch categories → status	200	122.170.197.61	2026-04-28 07:33:33.428973+00
87	admin@zarierp.com	admin	PATCH	/swatch-categories/1/status	Updated swatch categories → status	200	122.170.197.61	2026-04-28 07:33:35.985349+00
88	admin@zarierp.com	admin	POST	/user-management/users	Created user management → users	201	122.170.197.61	2026-04-28 07:35:39.28667+00
89	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:43:46.604739+00
90	admin@zarierp.com	admin	POST	/swatches	Created swatches	201	122.170.197.61	2026-04-28 07:44:50.746503+00
91	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:45:14.805787+00
92	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:45:21.414239+00
93	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:45:43.257389+00
94	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:45:56.769997+00
95	admin@zarierp.com	admin	POST	/styles	Created styles	400	122.170.197.61	2026-04-28 07:49:22.215909+00
96	admin@zarierp.com	admin	POST	/clients	Created Client	201	122.170.197.61	2026-04-28 07:53:40.884423+00
97	admin@zarierp.com	admin	POST	/clients	Created Client	409	122.170.197.61	2026-04-28 07:53:52.47976+00
98	admin@zarierp.com	admin	PUT	/clients/11	Updated Client #11	200	122.170.197.61	2026-04-28 07:54:12.470784+00
99	admin@zarierp.com	admin	PUT	/clients/11	Updated Client #11	200	122.170.197.61	2026-04-28 07:54:28.177213+00
100	admin@zarierp.com	admin	PUT	/clients/11	Updated Client #11	200	122.170.197.61	2026-04-28 07:54:38.911444+00
101	admin@zarierp.com	admin	PUT	/clients/11	Updated Client #11	200	122.170.197.61	2026-04-28 07:54:50.819846+00
102	admin@zarierp.com	admin	POST	/clients/import	Updated Client #import	200	122.170.197.61	2026-04-28 08:02:14.152094+00
103	admin@zarierp.com	admin	PUT	/style-categories/1	Updated style categories	200	122.170.197.61	2026-04-28 08:04:33.097335+00
104	admin@zarierp.com	admin	PUT	/style-categories/2	Updated style categories	200	122.170.197.61	2026-04-28 08:04:42.126104+00
105	anonymous		POST	/auth/login	Logged in	200	42.104.223.75	2026-04-28 08:09:59.3233+00
106	admin@zarierp.com	admin	POST	/lookups/unit-types	Created lookups → unit types	201	122.170.197.61	2026-04-28 08:10:59.004668+00
107	admin@zarierp.com	admin	PUT	/swatches/1	Updated swatches	200	122.170.197.61	2026-04-28 08:11:31.251712+00
108	admin@zarierp.com	admin	POST	/swatches/1/media	Created swatches → media	200	122.170.197.61	2026-04-28 08:11:32.280285+00
109	admin@zarierp.com	admin	POST	/swatches/1/media	Created swatches → media	200	122.170.197.61	2026-04-28 08:11:32.65744+00
110	admin@zarierp.com	admin	POST	/vendors	Created vendors	201	42.104.223.75	2026-04-28 08:12:27.771469+00
111	admin@zarierp.com	admin	POST	/vendors	Created vendors	409	42.104.223.75	2026-04-28 08:12:53.459362+00
112	admin@zarierp.com	admin	POST	/swatches	Created swatches	201	122.170.197.61	2026-04-28 08:13:11.532687+00
113	admin@zarierp.com	admin	POST	/item-types	Created item types	201	122.170.197.61	2026-04-28 08:16:13.908459+00
114	admin@zarierp.com	admin	PUT	/vendors/7	Updated vendors	200	42.104.223.74	2026-04-28 08:17:39.281241+00
115	admin@zarierp.com	admin	POST	/item-types	Created item types	409	122.170.197.61	2026-04-28 08:18:23.289607+00
116	admin@zarierp.com	admin	POST	/item-types	Created item types	201	122.170.197.61	2026-04-28 08:18:28.655332+00
117	admin@zarierp.com	admin	PUT	/vendors/7	Updated vendors	200	42.104.223.74	2026-04-28 08:20:44.647467+00
118	admin@zarierp.com	admin	POST	/lookups/unit-types	Created lookups → unit types	201	42.104.223.74	2026-04-28 08:35:00.261016+00
119	admin@zarierp.com	admin	POST	/api/materials	Created materials	500	42.104.223.74	2026-04-28 08:37:02.582676+00
120	admin@zarierp.com	admin	POST	/api/materials	Created materials	500	42.104.223.74	2026-04-28 08:37:50.673052+00
121	admin@zarierp.com	admin	POST	/api/materials	Created materials	500	42.104.223.74	2026-04-28 08:37:58.737715+00
122	admin@zarierp.com	admin	POST	/api/materials	Created materials	500	42.104.223.74	2026-04-28 08:38:24.410211+00
\.


--
-- Data for Name: artisan_timesheets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.artisan_timesheets (id, swatch_order_id, no_of_artisans, start_date, end_date, shift_type, total_hours, hourly_rate, total_rate, notes, created_by, created_at, style_order_id, style_order_product_id, style_order_product_name) FROM stdin;
1	3	3	2026-04-27	2026-04-29	sunday	10	300	9000.00	\N	admin@zarierp.com	2026-04-28 06:30:38.715314+00	\N	\N	\N
\.


--
-- Data for Name: artworks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.artworks (id, artwork_code, swatch_order_id, artwork_name, unit_length, unit_width, unit_type, artwork_created, work_hours, hourly_rate, total_cost, feedback_status, files, ref_images, wip_images, final_images, is_deleted, created_by, created_at, updated_by, updated_at, outsource_vendor_id, outsource_vendor_name, outsource_payment_date, outsource_payment_amount, outsource_payment_mode, outsource_transaction_id, outsource_payment_status) FROM stdin;
1	ART-001	11	Gold Zari Running Border	45	6	cm	Inhouse	16	400	6400	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	ART-002	5	Kadhwa Border Strip	50	8	cm	Inhouse	24	400	9600	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	ART-003	7	Organza Rose Cluster	22	15	cm	Inhouse	10	350	3500	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	ART-004	4	Net Border Zari	40	5	cm	Inhouse	14	350	4900	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	ART-005	4	Sequin Scatter Pattern	20	20	cm	Inhouse	10	350	3500	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
6	ART-006	2	Geometric Print Block	25	25	cm	Outsource	0	0	3500	Approved	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
7	ART-007	1	Zari Border Motif	20	8	cm	Inhouse	12	350	4200	Approved	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
8	ART-008	5	Katan Zari Bootaa	12	12	cm	Inhouse	20	400	8000	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
9	ART-009	6	Chikankari Motif	18	18	cm	Outsource	0	0	5000	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
10	ART-010	3	Leaf Crepe Embroidery	15	10	cm	Inhouse	8	350	2800	Approved	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
11	ART-011	12	Heritage Kalamkari Panel	35	25	cm	Inhouse	30	450	13500	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
12	ART-012	1	Floral Centre Panel	30	15	cm	Inhouse	18	350	6300	Approved	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
13	ART-013	9	Scattered Sequin Grid	30	30	cm	Inhouse	12	350	4200	Pending	[]	[]	[]	[]	f	admin	2026-04-18 07:17:59.244883+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.bank_accounts (id, bank_name, account_no, ifsc_code, branch, account_name, bank_upi, is_default, created_by, created_at, updated_at) FROM stdin;
1	icici bank	121242556567	ICICI6870	mumbai	zari embrodidaries	test@icici.bank	t	admin@zarierp.com	2026-04-20 03:59:01.036348+00	2026-04-20 03:59:01.036348+00
\.


--
-- Data for Name: bom_change_log; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.bom_change_log (id, bom_row_id, bom_type, order_id, inventory_id, material_code, material_name, old_qty, new_qty, delta, reservation_delta, notes, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: client_feedback; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_feedback (id, client_link_id, artwork_id, artwork_name, decision, comment, is_resolved, internal_note, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: client_invoice_ledger; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_invoice_ledger (id, client_id, invoice_id, entry_type, payment_amount, payment_date, transaction_reference, status, created_by, created_at) FROM stdin;
1	1	1	Payment Received	2950.00	2026-04-20	ohjkhkj	Completed	admin@zarierp.com	2026-04-20 04:25:01.971039+00
\.


--
-- Data for Name: client_links; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_links (id, swatch_order_id, token, is_published, hidden_images, portal_title, created_at, updated_at, closed_threads, style_order_id) FROM stdin;
1	3	b8e5675190411728969bbd2bf8a14fe9	f	[]	\N	2026-04-28 06:24:26.793281+00	\N	[]	\N
2	\N	a3309535d3d8e55098cabf11385868cb	f	[]	\N	2026-04-28 06:40:47.285643+00	\N	[]	2
\.


--
-- Data for Name: client_messages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_messages (id, client_link_id, artwork_id, artwork_name, sender, message, attachment, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.clients (id, client_code, brand_name, contact_name, email, alt_email, contact_no, alt_contact_no, country_of_origin, has_gst, gst_no, address1, address2, country, state, city, pincode, is_active, is_deleted, created_by, created_at, updated_by, updated_at, addresses, invoice_currency) FROM stdin;
1	CLI-001	House of Amore	Aisha Bhatia	aisha@houseofamore.com	\N	9871112233	\N	India	t	07AABCH1234A1Z5	23 Fashion Street	\N	India	Delhi	Delhi	110001	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
2	CLI-002	Vera Couture	Veena Rao	veena@veracouture.in	\N	9982233445	\N	India	f	\N	14 MG Road	\N	India	Karnataka	Bangalore	560001	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
3	CLI-003	Nila Threads	Nila Krishnan	nila@nilathreads.com	\N	9771234567	\N	India	t	33AABCN5678B2Z3	Anna Salai Shop 9	\N	India	Tamil Nadu	Chennai	600002	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
4	CLI-004	Meera Bespoke	Meera Joshi	meera@meerabespoke.com	\N	9661234567	\N	India	f	\N	Bandra West Row 5	\N	India	Maharashtra	Mumbai	400050	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
5	CLI-005	Elara Fashion	Elyn DSilva	elyn@elarafashion.in	\N	9541234567	\N	India	t	27AABCE9012C3Z1	Parel Unit 12	\N	India	Maharashtra	Mumbai	400012	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
6	CLI-006	Sanskriti Labels	Sangeeta Verma	sangeeta@sanskriti.in	\N	9431234567	\N	India	t	07AABCS3456D4Z2	Connaught Place B-8	\N	India	Delhi	Delhi	110001	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
7	CLI-007	Ruhani Couture	Ruhi Kapoor	ruhi@ruhanicouture.com	\N	9321234567	\N	UAE	f	\N	212 Palm Jumeirah	\N	India	Dubai	Dubai	00000	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
8	CLI-008	Mira Atelier	Mira Singh	mira@miraatelier.in	\N	9211234567	\N	India	t	08AABCM7890E5Z3	Park Street Suite 6	\N	India	West Bengal	Kolkata	700016	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
9	CLI-009	Aria Handloom	Aruna Pillai	aruna@ariahandloom.com	\N	9101234567	\N	India	f	\N	MG Road Ernakulam	\N	India	Kerala	Kochi	682016	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
10	CLI-010	Zoya Designs	Zoya Hussain	zoya@zoyadesigns.in	\N	9001234567	\N	India	t	06AABCZ1234F6Z1	Sector 29 Cyber City	\N	India	Haryana	Gurugram	122001	t	f	admin	2026-04-18 07:17:59.039876+00	\N	\N	\N	INR
11	CLI0011	Brand	dgdfgd	test@test.com		+91 3453543455	+91 54353453	Algeria	f	\N	\N	\N	Algeria	\N	\N	\N	t	f	admin@zarierp.com	2026-04-28 07:53:40.844592+00	admin@zarierp.com	2026-04-28 07:54:50.775+00	[{"id": "smhmbgtl", "city": "Pune", "name": "test", "type": "Delivery Address", "state": "Maharashtra", "country": "India", "pincode": "411045", "address1": "test", "address2": "test", "contactNo": "6565565656", "isBillingDefault": true}]	INR
12	CLI0012	New Brand	Firoz	firoz@onerooftech.com	\N	7775025222	\N	India	f	\N	\N	\N	India	\N	\N	\N	t	f	admin@zarierp.com	2026-04-28 08:02:14.11344+00	\N	\N	[{"id": "6s6wlawa", "city": "", "name": "Firoz", "type": "Billing Address", "state": "", "country": "India", "pincode": "411045", "address1": "12 MG Road", "address2": "Kurla West", "contactNo": "7775025222", "isBillingDefault": true}]	INR
\.


--
-- Data for Name: company_gst_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.company_gst_settings (gst_settings_id, company_gstin, company_state, company_country, export_under_lut_enabled, reverse_charge_enabled, gst_mode, default_service_gst_rate, created_at, updated_at, company_name, company_address, company_phone, company_email) FROM stdin;
1	27ABCDE1234F1Z5	Maharashtra	India	t	f	Auto Detect	18.00	2026-04-20 03:55:26.814494+00	2026-04-20 03:55:26.814494+00	ZARI EMBROIDERIES	ecstacy park mulund west	+91 9090909090	accounts@zarierp.com
\.


--
-- Data for Name: consumption_log; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.consumption_log (id, swatch_order_id, bom_row_id, material_code, material_name, material_type, unit_type, consumed_qty, consumed_by, consumed_at, notes, created_at, style_order_id, style_order_product_id, style_order_product_name) FROM stdin;
1	\N	1	MAT-005	Buttons – Premium	material	piece	8	admin@zarierp.com	2026-04-19 12:43:40.713144+00	\N	2026-04-19 12:43:40.713144+00	7	\N	\N
2	\N	1	MAT-005	Buttons – Premium	material	piece	2	admin@zarierp.com	2026-04-19 12:43:49.353612+00	\N	2026-04-19 12:43:49.353612+00	7	\N	\N
3	3	4	MAT-004	Embroidery Thread – Standard	material	spool	4	admin@zarierp.com	2026-04-28 06:29:44.179655+00	\N	2026-04-28 06:29:44.179655+00	\N	\N	\N
4	3	4	MAT-004	Embroidery Thread – Standard	material	spool	8	admin@zarierp.com	2026-04-28 06:29:51.883589+00	\N	2026-04-28 06:29:51.883589+00	\N	\N	\N
\.


--
-- Data for Name: costing_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.costing_payments (id, vendor_id, vendor_name, reference_type, reference_id, swatch_order_id, style_order_id, payment_type, payment_mode, payment_amount, payment_status, transaction_id, payment_date, remarks, created_by, created_at) FROM stdin;
1	1	Silk Route Textiles	outsource_job	1	1	\N	Partial	Cash	500.00	Completed	4564645	2026-04-20 00:00:00+00	\N	admin	2026-04-20 04:06:26.624793+00
2	1	Silk Route Textiles	outsource_job	1	1	\N	Full	Cash	735.00	Completed	\N	2026-04-20 00:00:00+00	\N	admin	2026-04-20 04:06:48.107552+00
\.


--
-- Data for Name: credit_debit_notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.credit_debit_notes (note_id, note_number, note_type, reference_type, invoice_id, vendor_bill_id, party_id, party_name, party_type, currency_code, exchange_rate_snapshot, note_amount, base_currency_amount, reason, remarks, note_date, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.currencies (code, name, symbol, decimal_places, is_active, is_base, updated_at) FROM stdin;
INR	Indian Rupee	₹	2	t	t	2026-04-19 16:48:26.9398+00
USD	US Dollar	$	2	t	f	2026-04-19 16:48:26.970682+00
EUR	Euro	€	2	t	f	2026-04-19 16:48:27.000149+00
GBP	British Pound	£	2	t	f	2026-04-19 16:48:27.029808+00
AED	UAE Dirham	AED	2	t	f	2026-04-19 16:48:27.060523+00
JPY	Japanese Yen	¥	0	f	f	2026-04-19 16:48:27.092784+00
CNY	Chinese Yuan	¥	2	f	f	2026-04-19 16:48:27.122711+00
CAD	Canadian Dollar	CA$	2	f	f	2026-04-19 16:48:27.152323+00
AUD	Australian Dollar	A$	2	f	f	2026-04-19 16:48:27.181585+00
CHF	Swiss Franc	Fr	2	f	f	2026-04-19 16:48:27.210669+00
SGD	Singapore Dollar	S$	2	f	f	2026-04-19 16:48:27.239936+00
SAR	Saudi Riyal	SR	2	f	f	2026-04-19 16:48:27.26924+00
QAR	Qatari Riyal	QR	2	f	f	2026-04-19 16:48:27.298257+00
KWD	Kuwaiti Dinar	KD	3	f	f	2026-04-19 16:48:27.32779+00
BHD	Bahraini Dinar	BD	3	f	f	2026-04-19 16:48:27.357267+00
OMR	Omani Rial	OR	3	f	f	2026-04-19 16:48:27.38655+00
\.


--
-- Data for Name: custom_charges; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.custom_charges (id, swatch_order_id, vendor_id, vendor_name, hsn_id, hsn_code, gst_percentage, description, unit_price, quantity, total_amount, created_by, created_at, style_order_id, style_order_product_id, style_order_product_name) FROM stdin;
\.


--
-- Data for Name: delivery_addresses; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.delivery_addresses (id, client_id, label, address_line1, address_line2, city, state, country, pincode, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.departments (id, name, is_active, is_deleted, created_by, created_at, updated_by, updated_at) FROM stdin;
1	packaging	t	f	system	2026-04-18 07:22:00.254501+00	\N	\N
\.


--
-- Data for Name: download_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.download_logs (id, user_id, user_name, user_email, file_type, file_name, module, reference, downloaded_at) FROM stdin;
1	1	admin	admin@zarierp.com	PDF	PO_ZSW-0103_28-Apr-2026.pdf	Purchase Orders	ZSW-0103	2026-04-28 06:26:29.758322+00
2	1	admin	admin@zarierp.com	PDF	QT-2026-00002.pdf	Quotations	QT-2026-00002	2026-04-28 06:35:31.452236+00
3	1	admin	admin@zarierp.com	PDF	QT-2026-00002.pdf	Quotations	QT-2026-00002	2026-04-28 06:35:51.767943+00
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exchange_rates (id, currency_code, rate, source_type, is_manual_override, created_at) FROM stdin;
1	USD	0.010783	Auto	f	2026-04-20 03:57:45.311345+00
2	EUR	0.009171	Auto	f	2026-04-20 03:57:45.341712+00
3	GBP	0.007988	Auto	f	2026-04-20 03:57:45.371132+00
4	AED	0.039579	Auto	f	2026-04-20 03:57:45.39896+00
\.


--
-- Data for Name: fabric_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.fabric_types (id, name, is_active, created_at) FROM stdin;
1	cotton	t	2026-04-28 07:17:48.624177+00
\.


--
-- Data for Name: fabrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.fabrics (id, fabric_code, fabric_type, quality, color, hex_code, color_name, width, width_unit_type, price_per_meter, unit_type, current_stock, hsn_code, gst_percent, vendor, location, is_active, is_deleted, created_by, created_at, updated_by, updated_at, images, reorder_level, minimum_level, maximum_level, location_stocks, height) FROM stdin;
1	FAB-001	Banarasi Silk	Premium	#F5E6C8	#F5E6C8	Ivory Gold	44	inch	850	meter	120	50072100	5	Banaras Silk House	Shelf A1	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
3	FAB-003	Georgette	Premium	#FFFFFF	#FFFFFF	Pure White	44	inch	280	meter	200	54075100	12	Mumbai Zari Works	Shelf B1	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
4	FAB-004	Crepe	Standard	#2C2C2C	#2C2C2C	Jet Black	44	inch	320	meter	150	54075100	12	Mumbai Zari Works	Shelf B2	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
5	FAB-005	Net Fabric	Standard	#FAF0E6	#FAF0E6	Linen White	54	inch	180	meter	300	54041000	12	Silk Route Textiles	Shelf C1	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
6	FAB-006	Katan Silk	Premium	#D4AF37	#D4AF37	Gold	42	inch	1200	meter	60	50072100	5	Banaras Silk House	Shelf A3	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
7	FAB-007	Cotton Muslin	Basic	#F5F5DC	#F5F5DC	Natural	36	inch	120	meter	400	52081200	5	Jaipur Print Works	Shelf D1	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
8	FAB-008	Organza	Premium	#E6E6FA	#E6E6FA	Lavender Frost	44	inch	420	meter	95	54041000	12	Mumbai Zari Works	Shelf B3	t	f	admin	2026-04-18 07:17:59.073507+00	\N	\N	[]	\N	\N	\N	[]	\N
2	FAB-002	Chanderi Silk	Standard	#E8D5B7	#E8D5B7	Champagne Beige	42	inch	620	meter	85	50072100	5	Silk Route Textiles	Shelf A2	t	f	admin	2026-04-18 07:17:59.073507+00	admin@zarierp.com	2026-04-28 06:43:02.169+00	[]	5.000	5.000	100.000	[{"stock": "85", "location": "Shelf A2"}]	
9	FAB0009	cotton	test	#c9b45c	#c9b45c	green	23	CM	1234	FSF	10	1234	12	Banaras Silk House	Out-house	t	f	admin@zarierp.com	2026-04-28 07:24:16.04875+00	admin@zarierp.com	2026-04-28 07:32:11.513+00	[{"id": "jmrmxub5q5n", "data": "data:image/jpeg;base64,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", "name": "ATT00001.jpg", "size": 97102}]	3.000	1.000	4.000	[{"stock": "10", "location": "Out-house"}]	
\.


--
-- Data for Name: hsn_master; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.hsn_master (id, hsn_code, gst_percentage, govt_description, remarks, is_active, created_by, created_at, updated_by, updated_at, is_deleted) FROM stdin;
1	123465	18	test data\n		t	admin@zarierp.com	2026-04-20 04:05:11.040352+00	\N	\N	f
2	77750252	12	Government Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Desc	Government Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Description*\nGovernment Descripti	f	admin@zarierp.com	2026-04-28 07:06:01.160643+00	admin@zarierp.com	2026-04-28 07:08:53.186+00	f
3	1234	12	sdfsdf	\N	t	admin@zarierp.com	2026-04-28 07:20:45.722462+00	\N	\N	f
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.inventory_items (id, source_type, source_id, item_name, item_code, category, department, warehouse_location, unit_type, current_stock, style_reserved_qty, swatch_reserved_qty, available_stock, average_price, last_purchase_price, minimum_level, reorder_level, maximum_level, preferred_vendor, last_vendor, is_active, last_updated_at, created_at, images) FROM stdin;
2	fabric	1	Banarasi Silk - Premium - Ivory Gold	FAB-001	Banarasi Silk	\N	Shelf A1	meter	109.500	0.000	0.000	109.500	850.00	850.00	0.000	0.000	0.000	Banaras Silk House	\N	t	2026-04-28 06:41:46.211817+00	2026-04-18 07:19:29.382513+00	[]
13	material	5	Buttons - Premium - Pearl White	MAT-005	Buttons	\N	Rack 3A	piece	490.000	0.000	0.000	490.000	12.00	12.00	0.000	0.000	0.000	Chennai Lace House	\N	t	2026-04-19 12:43:49.475702+00	2026-04-18 07:19:29.383453+00	[]
3	fabric	2	Chanderi Silk - Standard - Champagne Beige	FAB-002	Chanderi Silk	\N	Shelf A2	meter	0.000	0.000	0.000	0.000	620.00	620.00	5.000	5.000	100.000	Silk Route Textiles	\N	t	2026-04-28 06:43:02.586712+00	2026-04-18 07:19:29.382513+00	[]
14	material	6	Lace Trim - Premium - Ivory	MAT-006	Lace Trim	\N	Rack 3B	meter	180.000	25.000	0.000	155.000	85.00	85.00	0.000	0.000	0.000	Chennai Lace House	\N	t	2026-04-20 03:53:25.742035+00	2026-04-18 07:19:29.383453+00	[]
12	material	4	Embroidery Thread - Standard - Golden Yellow	MAT-004	Embroidery Thread	\N	Rack 1B	spool	238.000	0.000	0.000	238.000	65.00	65.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-28 06:29:52.013432+00	2026-04-18 07:19:29.383453+00	[]
4	fabric	3	Georgette - Premium - Pure White	FAB-003	Georgette	\N	Shelf B1	meter	200.000	0.000	0.000	200.000	280.00	280.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
5	fabric	4	Crepe - Standard - Jet Black	FAB-004	Crepe	\N	Shelf B2	meter	150.000	0.000	0.000	150.000	320.00	320.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
6	fabric	5	Net Fabric - Standard - Linen White	FAB-005	Net Fabric	\N	Shelf C1	meter	300.000	0.000	0.000	300.000	180.00	180.00	0.000	0.000	0.000	Silk Route Textiles	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
7	fabric	6	Katan Silk - Premium - Gold	FAB-006	Katan Silk	\N	Shelf A3	meter	60.000	0.000	0.000	60.000	1200.00	1200.00	0.000	0.000	0.000	Banaras Silk House	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
8	fabric	7	Cotton Muslin - Basic - Natural	FAB-007	Cotton Muslin	\N	Shelf D1	meter	400.000	0.000	0.000	400.000	120.00	120.00	0.000	0.000	0.000	Jaipur Print Works	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
9	fabric	8	Organza - Premium - Lavender Frost	FAB-008	Organza	\N	Shelf B3	meter	95.000	0.000	0.000	95.000	420.00	420.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-18 07:24:31.834825+00	2026-04-18 07:19:29.382513+00	[]
11	material	3	Beads - Premium - Crystal Clear	MAT-003	Beads	\N	Rack 2B	packet	170.000	10.000	0.000	170.000	350.00	350.00	0.000	0.000	0.000	Golden Thread Co.	\N	t	2026-04-28 06:40:05.008557+00	2026-04-18 07:19:29.383453+00	[]
1	material	1	Zari Thread - Premium - Antique Gold	MAT-001	Zari Thread	\N	Rack 1A	spool	48.000	0.000	0.000	48.000	2400.00	2400.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-18 07:24:31.834029+00	2026-04-18 07:19:29.383453+00	[]
10	material	2	Sequins - Standard - Silver	MAT-002	Sequins	\N	Rack 2A	packet	120.000	0.000	0.000	120.000	180.00	180.00	0.000	0.000	0.000	Golden Thread Co.	\N	t	2026-04-18 07:24:31.834029+00	2026-04-18 07:19:29.383453+00	[]
35	fabric	9	cotton - test - green	FAB0009	cotton	\N	Out-house	Meter	0.000	0.000	0.000	0.000	50.00	0.00	1.000	3.000	4.000	Banaras Silk House	\N	t	2026-04-28 07:32:12.699719+00	2026-04-28 07:24:16.227222+00	[{"id": "jmrmxub5q5n", "data": "data:image/jpeg;base64,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", "name": "ATT00001.jpg", "size": 97102}]
15	material	7	Mirror Work - Standard - Silver	MAT-007	Mirror Work	\N	Rack 4A	piece	1000.000	0.000	0.000	1000.000	8.00	8.00	0.000	0.000	0.000	Jaipur Print Works	\N	t	2026-04-18 07:24:31.834029+00	2026-04-18 07:19:29.383453+00	[]
16	material	8	Piping Cord - Standard - Off White	MAT-008	Piping Cord	\N	Rack 1C	meter	300.000	0.000	0.000	300.000	22.00	22.00	0.000	0.000	0.000	Mumbai Zari Works	\N	t	2026-04-18 07:24:31.834029+00	2026-04-18 07:19:29.383453+00	[]
17	packaging	1	pen	ITM0001	Stationary	packaging			120.000	0.000	0.000	120.000	10.00	12.00	0.000	0.000	0.000		\N	t	2026-04-18 07:25:16.768061+00	2026-04-18 07:23:16.475472+00	[]
\.


--
-- Data for Name: inventory_stock_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.inventory_stock_logs (id, inventory_item_id, action_type, quantity_before, quantity_after, quantity_delta, reference_type, reference_id, notes, created_by_name, created_at) FROM stdin;
1	17	adjustment_in	100.000	120.000	20.000	manual	\N		admin@zarierp.com	2026-04-18 07:25:16.796726+00
2	2	wastage	120.000	119.500	-0.500	manual	\N		admin@zarierp.com	2026-04-18 07:41:05.862342+00
3	11	adjustment_in	80.000	170.000	90.000	manual	\N		admin@zarierp.com	2026-04-28 06:40:05.038612+00
4	2	wastage	119.500	109.500	-10.000	manual	\N		admin@zarierp.com	2026-04-28 06:41:46.273003+00
5	3	adjustment_out	85.000	5.000	-80.000	manual	\N		admin@zarierp.com	2026-04-28 06:42:08.894319+00
6	3	adjustment_out	5.000	0.000	-5.000	manual	\N		admin@zarierp.com	2026-04-28 06:42:23.07266+00
\.


--
-- Data for Name: invoice_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoice_payments (payment_id, invoice_id, payment_direction, party_id, payment_type, payment_amount, currency_code, exchange_rate_snapshot, base_currency_amount, transaction_reference, payment_status, payment_date, remarks, attachment, created_by, created_at, updated_at) FROM stdin;
1	1	Received	1	Bank Transfer	2950.00	INR	1.000000	2950.00	ohjkhkj	Completed	2026-04-20			admin@zarierp.com	2026-04-20 04:25:01.971039+00	2026-04-20 04:25:01.971039+00
\.


--
-- Data for Name: invoice_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoice_templates (id, name, layout, payment_terms, notes, is_default, created_at, updated_at) FROM stdin;
1	Classic	classic	Payment due within 30 days of invoice date. Late payments attract 2% interest per month.	Thank you for your business. Please make all cheques payable to Zari Embroideries.	t	2026-04-19 17:59:52.830361+00	2026-04-19 17:59:52.830361+00
2	Modern	modern	Net 15 — Payment due within 15 days of invoice date. Bank transfer preferred.	We value your partnership. For billing queries contact accounts@zariembroideries.com.	f	2026-04-19 17:59:52.830361+00	2026-04-19 17:59:52.830361+00
3	Premium	premium	Advance payment required prior to dispatch. 50% on order, 50% before shipment.	Goods once dispatched are non-returnable. Subject to jurisdiction of local courts only.	f	2026-04-19 17:59:52.830361+00	2026-04-19 17:59:52.830361+00
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.invoices (id, invoice_no, swatch_order_id, invoice_date, due_date, client_name, client_address, client_gstin, client_email, items, discount_type, discount_value, notes, payment_terms, status, created_at, updated_at, client_phone, client_state, cgst_rate, sgst_rate, bank_name, bank_account, bank_ifsc, bank_branch, bank_upi, style_order_id, invoice_direction, invoice_type, invoice_status, client_id, vendor_id, reference_type, reference_id, currency_code, exchange_rate_snapshot, subtotal_amount, shipping_amount, adjustment_amount, total_amount, invoice_currency_amount, base_currency_amount, received_amount, pending_amount, remarks, created_by, shipping_address, carrier, tracking_number, dispatch_date, expected_delivery) FROM stdin;
1	INV-2026-00001	\N	2026-04-20		House of Amore	23 Fashion Street, Delhi, Delhi, 110001	07AABCH1234A1Z5	aisha@houseofamore.com	[{"id": "b9927d12-255e-4ec7-9f42-7d1ea04fe63e", "total": 2500, "hsnCode": "96062100", "showHsn": true, "category": "Item", "quantity": 10, "hsnGstPct": "", "unitPrice": 250, "description": "MAT-005 · Buttons · Premium · Pearl White"}]	flat	0			Sent	2026-04-20 03:59:47.529201	2026-04-20 04:25:01.971039	9871112233	Delhi	9.00	9.00	icici bank	121242556567	ICICI6870	mumbai	test@icici.bank	\N	Client	Final Invoice	Sent	1	\N	Style	ZST-2601	INR	1.000000	2500.00	0.00	0.00	2950.00	2950.00	2950.00	2950.00	0.00		admin@zarierp.com					
\.


--
-- Data for Name: item_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.item_types (id, name, is_active, created_at, is_deleted, created_by, updated_by, updated_at) FROM stdin;
1	test	t	2026-04-28 08:16:13.869506+00	f	admin@zarierp.com	\N	\N
2	tests	t	2026-04-28 08:18:28.619706+00	f	admin@zarierp.com	\N	\N
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.items (id, item_code, item_name, item_type, description, unit_type, unit_price, hsn_code, gst_percent, current_stock, location_stocks, images, reorder_level, minimum_level, maximum_level, is_active, is_deleted, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: material_reservations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.material_reservations (id, item_id, inventory_id, reservation_type, reference_id, reserved_quantity, status, remarks, reserved_by, reservation_date, created_at) FROM stdin;
1	13	13	Style	7	0.000	Converted	BOM row 1 — Buttons – Premium	admin@zarierp.com	2026-04-19	2026-04-19 12:41:42.794449+00
2	11	11	Style	1	10.000	Active	BOM row 2 — Beads – Premium	admin@zarierp.com	2026-04-20	2026-04-20 03:53:11.654614+00
3	14	14	Style	1	25.000	Active	BOM row 3 — Lace Trim – Premium	admin@zarierp.com	2026-04-20	2026-04-20 03:53:25.742035+00
4	12	12	Swatch	3	0.000	Converted	BOM row 4 — Embroidery Thread – Standard	admin@zarierp.com	2026-04-28	2026-04-28 06:25:11.061862+00
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.materials (id, material_code, item_type, quality, type, color, hex_code, color_name, size, unit_price, unit_type, current_stock, hsn_code, gst_percent, vendor, location, is_active, is_deleted, created_by, created_at, updated_by, updated_at, images, reorder_level, minimum_level, maximum_level, material_name, location_stocks) FROM stdin;
1	MAT-001	Zari Thread	Premium	Gold Zari	#D4AF37	#D4AF37	Antique Gold	1kg spool	2400	spool	48	56010000	12	Mumbai Zari Works	Rack 1A	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
2	MAT-002	Sequins	Standard	Round	#C0C0C0	#C0C0C0	Silver	3mm	180	packet	120	56012200	18	Golden Thread Co.	Rack 2A	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
3	MAT-003	Beads	Premium	Crystal	#E8E8E8	#E8E8E8	Crystal Clear	4mm	350	packet	80	70181000	18	Golden Thread Co.	Rack 2B	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
4	MAT-004	Embroidery Thread	Standard	Silk	#C6AF4B	#C6AF4B	Golden Yellow	200m spool	65	spool	250	56010000	5	Mumbai Zari Works	Rack 1B	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
5	MAT-005	Buttons	Premium	Pearl	#F8F8FF	#F8F8FF	Pearl White	12mm	12	piece	500	96062100	18	Chennai Lace House	Rack 3A	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
6	MAT-006	Lace Trim	Premium	Crochet	#FFFAF0	#FFFAF0	Ivory	1inch wide	85	meter	180	58080000	12	Chennai Lace House	Rack 3B	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
7	MAT-007	Mirror Work	Standard	Round Mirror	#C0C0C0	#C0C0C0	Silver	1inch	8	piece	1000	70099900	18	Jaipur Print Works	Rack 4A	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
8	MAT-008	Piping Cord	Standard	Cotton	#E0E0E0	#E0E0E0	Off White	4mm	22	meter	300	56049000	12	Mumbai Zari Works	Rack 1C	t	f	admin	2026-04-18 07:17:59.107997+00	\N	\N	[]	\N	\N	\N	\N	[]
\.


--
-- Data for Name: order_shipping_details; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.order_shipping_details (id, reference_type, reference_id, client_name, shipping_vendor_id, tracking_number, tracking_url, shipment_weight, rate_per_kg, calculated_shipping_amount, manual_shipping_amount_override, final_shipping_amount, shipment_status, shipment_date, expected_delivery_date, actual_delivery_date, remarks, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.orders (id, order_id, order_type, client, status, priority, assigned_to, delivery_date, remarks, production_mode, cost_status, approval_status, invoice_status, invoice_number, payment_status, fabric, swatch_length, swatch_width, quantity, reference_swatch_id, reference_style_id, product, pattern, size_breakdown, color_variants, materials, consumption, artisan_assignment, outsource_assignment, artwork_hours, artwork_rate, artwork_feedback, material_cost, artisan_cost, outsource_cost, custom_charges, total_cost, client_comments, share_link, is_deleted, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: other_expenses; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.other_expenses (expense_id, expense_number, expense_category, vendor_id, vendor_name, reference_type, reference_id, amount, currency_code, payment_status, payment_type, paid_amount, expense_date, remarks, attachment, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: outsource_jobs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.outsource_jobs (id, swatch_order_id, vendor_id, vendor_name, hsn_id, hsn_code, gst_percentage, issue_date, target_date, delivery_date, total_cost, notes, created_by, created_at, style_order_id, style_order_product_id, style_order_product_name) FROM stdin;
1	1	1	Silk Route Textiles	1	123465	18	2026-04-02	\N	\N	1235	\N	admin@zarierp.com	2026-04-20 04:05:34.506871+00	\N	\N	\N
\.


--
-- Data for Name: packaging_materials; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.packaging_materials (id, item_name, department, size, unit_type, unit_price, vendor, location, is_active, is_deleted, created_by, created_at, updated_by, updated_at, item_code, item_type, current_stock, reorder_level, minimum_level, maximum_level) FROM stdin;
1	pen	packaging			10.00			t	f	admin@zarierp.com	2026-04-18 07:23:16.439852+00	\N	\N	ITM0001	Stationary	100.000	\N	\N	\N
\.


--
-- Data for Name: packing_list_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.packing_list_items (id, packing_list_id, item_type, item_id, order_code, description, qty, unit, created_at, weight_kg, item_image_url) FROM stdin;
\.


--
-- Data for Name: packing_lists; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.packing_lists (id, pl_number, client_id, delivery_address_id, shipment_id, destination_country, package_count, package_type, dimensions, net_weight, gross_weight, status, remarks, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: packing_package_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.packing_package_items (id, package_id, order_type, order_id, product_id, order_code, description, quantity, unit, item_weight, item_image_url, created_at) FROM stdin;
\.


--
-- Data for Name: packing_packages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.packing_packages (id, packing_list_id, package_number, length, width, height, net_weight, gross_weight, shipment_id, created_at) FROM stdin;
\.


--
-- Data for Name: pr_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pr_payments (id, pr_id, payment_type, payment_date, payment_mode, amount, transaction_status, payment_status, attachment, created_by, created_at, updated_by, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.purchase_order_items (id, po_id, inventory_item_id, item_name, item_code, ordered_quantity, received_quantity, unit_price, warehouse_location, remarks, created_at, updated_at, item_image) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.purchase_orders (id, po_number, swatch_order_id, vendor_id, vendor_name, po_date, status, notes, bom_row_ids, approved_by, approved_at, created_by, created_at, updated_by, updated_at, bom_items, style_order_id, reference_type, reference_id) FROM stdin;
1	PO-26-0001	3	6	Chennai Lace House	2026-04-28 06:26:17.300271+00	Closed	\N	[4]	admin@zarierp.com	2026-04-28 06:26:25.016+00	admin@zarierp.com	2026-04-28 06:26:17.300271+00	admin@zarierp.com	2026-04-28 06:28:19.483+00	[{"bomRowId": 4, "quantity": "12", "unitType": "spool", "targetPrice": "60", "materialCode": "MAT-004", "materialName": "Embroidery Thread – Standard", "targetVendorId": 6, "targetVendorName": "Chennai Lace House"}]	\N	Swatch	3
\.


--
-- Data for Name: purchase_receipt_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.purchase_receipt_items (id, pr_id, inventory_item_id, item_name, item_code, quantity, unit_price, warehouse_location, remarks, created_at, po_item_id, item_image) FROM stdin;
\.


--
-- Data for Name: purchase_receipts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.purchase_receipts (id, pr_number, po_id, swatch_order_id, vendor_name, received_date, received_qty, actual_price, warehouse_location, status, created_by, created_at, updated_by, updated_at, bom_row_id, style_order_id, vendor_invoice_number, vendor_invoice_date, vendor_invoice_amount, vendor_invoice_file, vendor_invoice_uploaded_at) FROM stdin;
1	PR-26-0001	1	3	Chennai Lace House	2026-04-28 06:27:28.983165+00	10	70		Open	admin@zarierp.com	2026-04-28 06:27:28.983165+00	\N	\N	4	\N	\N	\N	\N	\N	\N
2	PR-26-0002	1	3	Chennai Lace House	2026-04-28 06:28:19.434527+00	2	65		Open	admin@zarierp.com	2026-04-28 06:28:19.434527+00	\N	\N	4	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: quotation_custom_charges; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.quotation_custom_charges (id, quotation_id, charge_name, hsn_code, unit, quantity, price, amount, created_at) FROM stdin;
1	1	charge1	123465	\N	1.000	100.00	100.00	2026-04-28 06:35:24.878352+00
2	1	charge2	123465	\N	1.000	900.00	900.00	2026-04-28 06:35:24.878352+00
3	1	charge3	123465	\N	1.000	2500.00	2500.00	2026-04-28 06:35:24.878352+00
13	2	charge1	123465	\N	1.000	100.00	100.00	2026-04-28 06:36:30.800753+00
14	2	charge2	123465	\N	1.000	900.00	900.00	2026-04-28 06:36:30.800753+00
15	2	charge3	123465	\N	1.000	5000.00	5000.00	2026-04-28 06:36:30.800753+00
22	3	charge1	123465	\N	1.000	100.00	100.00	2026-04-28 06:36:57.098967+00
23	3	charge2	123465	\N	1.000	900.00	900.00	2026-04-28 06:36:57.098967+00
24	3	charge3	123465	\N	1.000	6000.00	6000.00	2026-04-28 06:36:57.098967+00
\.


--
-- Data for Name: quotation_designs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.quotation_designs (id, quotation_id, design_name, hsn_code, design_image, remarks, created_at) FROM stdin;
1	1	gown	123465	data:image/jpeg;base64,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	\N	2026-04-28 06:35:24.878352+00
5	2	gown	123465	data:image/jpeg;base64,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	\N	2026-04-28 06:36:30.800753+00
8	3	gown	123465	data:image/jpeg;base64,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	\N	2026-04-28 06:36:57.098967+00
\.


--
-- Data for Name: quotation_feedback_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.quotation_feedback_logs (id, quotation_id, feedback_text, feedback_by, feedback_date, revision_reference, created_at) FROM stdin;
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.quotations (id, quotation_number, client_id, client_name, client_state, requirement_summary, estimated_weight, estimated_shipping_charges, subtotal_amount, gst_type, gst_rate, gst_amount, total_amount, status, revision_number, parent_quotation_id, internal_notes, client_notes, converted_to, converted_reference_id, converted_at, created_by, created_at, updated_at, cover_page, cover_page_image) FROM stdin;
1	QT-2026-00001	1	House of Amore	\N	test	2.000	200.00	3500.00	GST	18.00	630.00	4330.00	Draft	1	\N	test	test	\N	\N	\N	admin@zarierp.com	2026-04-28 06:35:24.878352+00	2026-04-28 06:35:24.878352+00	custom	data:image/webp;base64,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LmNvbS9hZHMvMS4wLyc+CiAgICAgICAgPEF0dHJpYjpBZHM+CiAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSdSZXNvdXJjZSc+CiAgICAgICAgPEF0dHJpYjpDcmVhdGVkPjIwMjQtMTAtMTA8L0F0dHJpYjpDcmVhdGVkPgogICAgICAgIDxBdHRyaWI6RXh0SWQ+ZDQ3OWFlZDMtYzBlNy00YTI1LWIwYTMtYjUzOGFhZmQwODZiPC9BdHRyaWI6RXh0SWQ+CiAgICAgICAgPEF0dHJpYjpGYklkPjUyNTI2NTkxNDE3OTU4MDwvQXR0cmliOkZiSWQ+CiAgICAgICAgPEF0dHJpYjpUb3VjaFR5cGU+MjwvQXR0cmliOlRvdWNoVHlwZT4KICAgICAgICA8L3JkZjpsaT4KICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgPC9BdHRyaWI6QWRzPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgICAgICAgPHBkZjpBdXRob3I+UG9vcm5pbWEgc2F0aHlhbmFyYXlhbmFuPC9wZGY6QXV0aG9yPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnhtcD0naHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyc+CiAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5DYW52YSAoUmVuZGVyZXIpPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgICAgICAgCiAgICAgICAgPC9yZGY6UkRGPgogICAgICAgIDwveDp4bXBtZXRhPgA=
3	QT-2026-00003	1	House of Amore	\N	test	2.000	200.00	7000.00	GST	18.00	1260.00	8460.00	Sent	2	2	test	test	\N	\N	\N	admin@zarierp.com	2026-04-28 06:36:46.312192+00	2026-04-28 06:37:57.33514+00	modern	data:image/webp;base64,UklGRkYHAQBXRUJQVlA4WAoAAAAEAAAAHwMADwQAVlA4IB4CAQBQjgWdASogAxAEPpFCm0slo6kqI/NbiUASCWdrk+veDea31vSSs/S+W/6Fa87G+uw8nOQpgDZHDGEb5M+v2J/Qv89ymuW/1XtbeCLQF331ADwX+aH7R9NP/j+jj+m/53ozNLF6vJvrF6/ORZs86vlcomDewL0N+Tf+7zt/Nv8nwN/OOmc0L2r/fRnm+c/eL+3/33oL/qn+T9NiLd4uoK64HXL+Gf2vsGfsJ6i/+nzFvzf/l9hP9j81j9m/63sREB81DsyO9rIl7vxfMCNqtwPXc0omHBTmdJpJaqJLu0wjepedZ2smpUDLbZvnIzkEHxmBpHAiHSdgiWvNZE3rzW8Wp9NUvP4Vd9Nmzj0GJFRon8zyDRsR10ao+WhpNxzbajg4orK7gbG5Y4XdY6+x44RXZ0Jdax6ZwougfPtt/q2kVNSplXcfSydZoTdds9tDbHuuFmhyX6v7MMp2zdd9tu63NJF2ospJJE0dhBbeJTzWG7be6hUpqogVJ2pc3ys84d94mvklYpyaQ3r4QPj8jBJlfqYpJxJr8FHqFRh4hXgyM35jlrDdmTgyxo1MlwKYq1JcyafjE+CDEcPtUOi8t+FY4LZlq+q6kzPtSWdZrqKUvQq70f3Ev2JHeGvpjPL7Y+ZO4Gq2UiGupqfG6GDCOxZapKP6LrUwqM8/5mpp7ULbRCuiLbqEap1ukbD1reKveqK7kWGO6E7K/iXwa+Sfg38qCGVtkfox1QBdlTfSmGE+3xHVAdzEeLz4V2PayeRHLPaYk0AE04+lWMhQEEqxEQs6qubZ3o3wZ+EzpJmJHgfvkXngu88IfunVZkj6EnUWe+0CbJdBOCLdlXo81soQoCg2EvBLdkNTKQn04gj7bUZi7KoTbsvp0j3l5MqK6ejuRlpyI5l03kl1psqDzS4d60Mq6HxiFSNOXPHujb6OqfhgiPuBXcG5rOfngLwgmNnot2rj8yUm8tNwgXreHrtXESjrKqm4uXfqb6LEPC85YWQx19c9LjgfqSBFubnFjJ1YP8fM4+3l8FAJr/HfzK+ce7vBDGR27L6o3aEW8xsU+aoUPlftYeU3oGPB1ZhMMm9P8I7ughNumwsPHpw1TIigFjMcZZUyex849HV3kS8WtGImjEUCDKzTjKgwhj+yUL2v6GgwE0rjuovZdMXE9wI9h4wsL+CqEFwNlO74k7Ow2xCMEgPZi7ocOaCaKAyGczq1XaxQZoO1fJhOwjayTRWmQidLQb2DPvFvqWS0X5tIipxmOk40djE6OEo+wp8gJdmzafWzwi55SRaFDvef1IUEhzSl2FrLmg5uN8JuFEtAUzUVp+SBw2+W5UMROIkqxYIrieRYUfjKfyogEUz1RsWsKnr7k4QpyFyapOYutLYjuDU/zFOuJWz/KD7dx3rDJQ5q3W6Qkr+WWwcAGAg5zZwiUlkZU1emIV/mG46pWZphWc83CuivZyY6osa63PXRtEm4kKEug4TImFMzYM7AGY5U5mATcUJ49dp8lGkDyVtSjuMF1Y9D2eikySfFgBcGKJX9Z7fsg6VsdcFwD1kUSZpiKIovF7Jxf5jhAqO8GClLT8zRuzIMIMvTGaCxIeyiHWry+jMYucctZ+TEL56Y7lPjzdTpH49MbXB2rLkaEXgSFSD2aDO9wnajg1Dxxh+6aANVb+5tSkdMRoxDux0TtFnqYCK8vbKOq+7r/NWNlAUUQWJDKXlzJB7lNgCQvo25UWJH35LVrtCllAYDD96GJYvN70jLymC3ADleyzpMbJeANJNTmxnMfvbjsaK9JlHy/+dW8PGYBv7PA7revbmQX3VLqAtQYSoLjtYeUDWR7NnlMTnpAIhdftgq0CmQA/6V02CHZejovqek4WhHUI26S4/Sza82WzKVU681anqaVFbwzm5sqIDaaRQ5m9300fbc5dW+YXJ3h8BWtmQs/cmQwi9k/Z859YvsD7ZhhrsY5nAT4EcDuZlWxb2kOMFL9q+h9vg9jGH8JyqoWQ3sa7Lvw8PCxL5EaCpGJoKiFmGyGNgzE4imzTBj3CpqYqoxD0NwSrwjThhLDwgfzdqyJqqmwwHm3+3pi0sds6kIilhCl21Lesa/dJm3jNdDcvPsRx7E3Zq2Ga+jDzReXBkQITaaJMGtHR9YJ67EOmvvhgcOHFdR3F9C+TlhdhkHmb/he6FQJ/lXrhZ0qiYEe0RpmxpFn9KExIPCMpwdQ926hNyMNIH7x3mS3Q+7hI8Q7kHcpZm4yhX/4CGbR68cEtuAaSjWlMMmQFX+G1Cq5wXElFmFkVvlVc2Rw6ShQ+Tgg+LoofVjytLwooM4uKP0dEgmmHhXiNlF8OMG4QLKK/VJ7x8AQI7FdzVNawFhIxC1mjQhY/nTGBi4RqYoTLzfwMV7AiXVlhWDxxAJrsjLvNP2tflJFQZkdHmXPeYaxXym8tz44fP+aa6pAz7E2udy5ciAPyRpRRU+OB3Mez2iaqKYEFcRt7Pa5/KqO8EBZTUTcbXYj9iiaHUrn9zgINccU+FwexpuXFe935GnakMnHcmz3tynHHqSD/8XYqDr4IjoqWRIvw9GT5gCNolPxRTbyNTGALMJacw9epOSu8t2IifdrWEP+3KFywY7Un/WR8VF8qZUbnG2mN2fMhoCOh7X1pvx5ds2YyNoOdf0kqhTkCfchRiB4jANQ+orY/vUTUD4QuUHNdCM6nvOTZlZ3cY4bGT5ECqQ+U2i2+CiZjUJOkFLtR8gpuhd6y2ol750kOltXfnuDoRgpLngqFlF4jhIYfd15mpXwcPZcWHYPbrzkGLcCNJfm1qoCKkCUuuUrHhScZQ5f3GkVh2zIwcaht+EHQnZOQ12P+/WuEC2mywiqkso+7/9QZTldPgyUJBvolAex4Cp365Dmrm7h1GcJQRMlOtXkUqYhCTqcyDevAykxHUUcIBErJ77AXrJo54em7amuhsJWp+GSCJiH3lSDvSBwxCxKAD0U8t8qssbLH8y5GNvEUBElWV91HRKRk4ph3Fpl/FfPQ54xoMoGtP9qRuBSYqjoi2MbG1lNE7lzjFyN4ca++mc5n/Ww8WYqyBh6XTiq6RhFKLl5fu6Gxr2X7ImeuoFLJNmvbfFnlPzX9ROmGPM1zHLsEYlv61FfsOfPEQVXGcs7FrxKeAJXSuTow4xaEQ4X1SW05F+2HKL9L7fmgFZ4SsDa+mZq0SJJdiWp4VNrN92UrqK6ZdaIGgPjqgmKmMkjYYW9DF7pKrmh52LXkiaF9M1MLHK8e/I97K5XD0hmq4iUXxbSh0DXCRg1A37Ix3bsykh0bPTDdPBOO4nWTfRn2PGEh2Kv+qmBcZEu3i2FlqPY2kYrvuFrsBSmvj+W/aM2QDzc3LxgXdaRCU0IzLDaQCZN+7udpy60xn/gNeHV8A6uK/ADq8eVnyVOAHpyOBVm40cRB0BjDcRrv1/BGoO+i5Na9iyoEMSNtQeYA318TeY588DK2cvRuuYRqesPZlCGLCqs447ov7JiyQz8/O1aZJKsZucxM/nxGuxb6LYDnCPIrFm/BTxSQfJ878/97xyHOc1s+5QGETqXkVcBUPY5L7D0ZMCM+NPs4oHXZbjblXjjVENJu8GXhFgv5GV9GOqiyPwAoBYvLpgQEtI4URkkyWYKy3XWebZB/L1xd1wy59pDNkTDlKymNEftBA03C4Mb2OS4tonW+jJ2G9/wo10oDDjBhJxzAJ4NwETtkWdtRUJpJjUDWCWnTkoqVCoU5aoklVVAQFLbH+jz+2JtDcGCFVCohSR1/Ci5xUhSxO6ejUw83bFEAcKFLkhdqV6d+2G8l8V4dPhVw+4Na6D/7sGHyCxq56KbPrjwbV++41qigpoZCTuGQ81W61sqs5SUFJO06NOgHVFMCoP51mlLcoX5DeArXIJEDfkuk2xsihiQrjt/BXJyUxl3cbycGqCE4IHpgVwQHoqEuTE5Rfs9sK2jFoSuKDVydT0npTD+e3Nwop8oD82boY76Nw2Gnbx7TJwMeLHQHPIi+FgQMOtatIWtvouTFw5nCBDWjwgQvjo6a61AmYqXXTh6Ko1WfhJ4+E7YKKv0JvpCsqHGsa4JB+5Kbsc/URF28fmNlV1Hkx1w5gJCfqcds8k3LRe0qKL2aTqsYazui2N8YhmoiwVkqs+8iojEJgk0kqtqOLWG680tbLf7vlWSDcpH/7068tqCfTymY+XbD9Nr5ctOVrf/+LAFLhGSSr/NmGwkP2LIqwXjR0WNcIkFxBdK2MhjHZqeCTKpbOt/LGw72e3uRjpD1HtMA+CZeaCWSULW4gbm9JFTYeuuxJceKv7Ezi0wKZMqdF+dLpFAzcYDbVK4gx32tLjc3yYYRbjxodQyAb4elreEqBt2eznNFptktahBh+mrLbnvUnVjjFe49GZA2dAY3rNfmszmXZs/Jeo9daCDeXJwgV4Pgex7AZ9J6aCeeiJvO1QhnhKH7YWCzZpYRCHuxBknLKyinM1Q/uSgm0RP/CuKwROrc0SZdAEd9Bg1r+h9vr52scMhm52ZYOrh2gaHjzWJ2rTLrDafL5zV3/fvOSMpm3iw1B32XfwUi5wSmmHZvJi4QiSZkz0pwIehhPJRCS7ypMh+ubdNBEIX3nwjVz2taAPhqc1bG9K1Isi+7wS+JTgrnCHDyKyxGZtmQ7/JPoIlRxxUGLy0W9tTfHHpVd9eXTJqcktBj+lT1wbLu2Nbglzi52Zw4JFhYnwD+pRbmDpY5uGHPsaDUFA29UeAcs57kjjzG29nk9NmiNJ+9QUDRALdrB8HD0sM1V2uH+yNWB+d6+mduHCnu4KxRFAP99JKKRm8KY77yPKTlNvqOS9KXax6vL0BDrYD8XII8OoG7mTOfuXW7JaU5/rpB4bCzmjf1mYTFvUt5qGn05LNJZGwC63NiG9Ek1wPG5nThfBUUVkdQ+n7Q1CrUnkPGd2eJIVEhrTWIRfojkVjFEereu0agjiJmlRBaZ95KT922V1TuEyu93RzXa189Y1oT9LoQ0BT6ewu1JYjSPGYo0S+8dCYLgA4NFbqW1TegnLwTsf9rgxYlgJ4mqSVR2he2zG5SzksIaJPOIm3JoS11dkQM1DJ68apuqisCLYo9r9OWSUXrSeW+wDqcbfgVhi3GxWv0WMy+rayq3KT5kia3+DnhzFpGuf8vja79SwovphNEJn/9JHYVkpdGFyXjjsig6cfhYJ0qY5ncGURqz67bTnjPmfw9AV/bw2wAkEeqnTR2ioJ6nidy/TaIEMcnE/m8wmZ/3QyhmKAGVbnzMP2CjQIem84WXDCqa+lBgliaMZHhN/4LPwOOzbJ/ghMqXTP/JnJIIIgVIsmHGtMudean5LSkKHtcZF/YGgsERPU01v5HZAALK5p0mRMexXvFznjWFAJn8Ml9bInVp8mN9YJQzae7Og+UN8tTaz3qZijH4MK2k/a/hNZfeLPOjAjL14Z59Rp9A/g/KyL+K+Z11mGrM3uGkm9GUtaiopbaT59lUoFlOeCLTC0PnyjVsHfWCaziLhcWn3pc0mKYz5VlVWfks065BG6KZzNe/ifqLObq5lvyUHW2a9YT/HJRRwyqlLAI4v4+G0LlC+6j9soqZl8lycRqritdiHfXxvn3LydREzz1D/ivpC5igKG3PLpxiduBpdf9J7J6rb5mdP8MJYqPCmFwZlRFataeRDdsaNvQSyGBPeZCBIL0YDmcIZA2hU/8zIrdzMHDcbS8ZIIBsHe/XoVqS1kNiAqkfkK63EBFSebzG77dVBDPwe8wZv8taqDtrE5GZu4hIYMvKtWhC9OqLWPLxGY8lch9LyDj5mn3ctiXB3qMOhXiypjRC5fZGu3FUavfBkqqksK+uj+4LFqT48AjlKxTZU2w52otZohEQX+Eh4it3YuixAfkAuY1m6QPEbNxCbZumvT4Sz9z/yueXuiXY+Q0GyUzHDX7/qknAx+VqFqWj1DIp3ZsJlHP6b+mouJZ2x/J4luxihd8oGS+y0jUhjlXkzi87NopsDYwU3vgBihPAkB9fzDB1Ye9bWSo6cpkhxAlo25lFRrKZjGzlMcsa+n2Iryu07aT0eoVFXwVA1wSHm7Lh1w2L1S4FIFVHT1//d3Ki2NwIJ2F8inmiW0czljBp60cbDIVoQva3rs2gJbov80TXid/1xrR8q9+bIlmTP+LRTzaLxQlKWU1b0zqudKqVBgPkITWCyxeyoGvxRjxvgaf050QGn93yK2rWenvgCGM25uPLq8KDHO7/IvgStWK0tDxzLERnONV5rJPVUxOLH29tI7upFOkacIlZKTh5oRMpswUDzMo7HyKn/YENPyILDk1tO+3KfNiA6FQ8wFDOTs0li/ULPeGxUblmKkqF9/VbPPziNX9TJEUidQnD++Lj8fetD4cCdrMqyvvhn1LkGLd7c+Rvya3NYvRkO7q7C3eOYHD8m27PsZvFT+is/SGBKrwsLJca8WbSEQXW3aHzAFqRJapT7b45wFUBqOxHWIItErxY4ZZlcjzOXg2NFwSP3vobz6J5N6sNpNlNPjFhyAeY2vw2aSKh26OMPC7/RlKT+xP9juv4jbVALu/h0sJBMmQaPL8PKARzNrNyBNN0DN8c8WBWsei4KJ9URZFuEf9ildgSpV22GM7F1AYTYQWtktr50jdby52IwWm5KoqHY4rg6wOE3KRpR9K/LuIcd4svj0bc8/J+8QzUOs5mls8P+0F6xh18vr4fkJYHFBoDF9OgM9eLJgz/WZLOR0pNW64FpT4GW+7OPz/vJrLvq8WjInlxUv3c1eeR6/VHUpmHL4KuwK5AbCbJcEaUxfPndEceoVd+m3tsyOSvI3j1h6APi+FeAdZqb7jGv97ll0PaivJZWWVbAv37EeUp14feeNdR2wCbKAk/Ysd9Sy9UyNM6tWfMuODPYejp1rxsQ1GoXhTQlzSMmup9BD9AcdM4SmxV2TQNZfyIG6+wUYRTRiNuyiXmBb2z2SQR30y5YYZPxhlVBVlC2FE4wvJZ6OUmyNAGW7JhW8+x7Ml95OqcR5FMddl+wL/4Wn6gT8n5Is6vxqOg3DhAvX3/QxSLp1lFtTJ9L5Oof373AltLDx2RvbZ+0GfunhxohJQb92TZZQYaa70Er11CzKfYmiJDZq4RVyZF6StZk36TnTTpT8mpk7Qp4rRUjnUTEuipbXmyT73yLXwmIiJexUezY17QAHbawAomV62e3DJaEpbG80Deu+q3v/r2AIfyQvP0znrZ/44U6guQhjgJ6wEnhJBcDORRrRXcND3bUCwQ07+4Ka5MLR8RWqAQ1Jxv5CCIJRtz4eDM9Is5CMYDowVgjAuLpKd3SmsyH3v/7LiLhk3FSztLYdu8SAERY6HxXQpcXmcwxMWr+qnrrifVQ7NiT69G5DZC5IW0dSEWz9WokFCLzWOw6HmGELGMM+pQaBsZwmx1lmMER2hknSyF+BoQwJGve8MH9klcaqbMOc6buEeHws7vYPo1sD6QDGREWY4YCBUpBkKj1Zw7ZUFL2R4bT7mVxM6sP7zhfLMjJz3JRj1zoxJkRFnlKryJJpGUaiBcEdqn99GnHaJnBdDvrOgzfFYFroITgbFCZBjecJjRquo8gXbI4CT5LQTgZVxDA5ZkoyqoZQ7hRjyi0OjzmKGIurtU0XUB8uTETyS71AzmAGvROoiiDfnb19EKhku/C6LaeB9XaLkFsQcnaGKh1T0Hp4fPp0tkrLOmZqgYLaCjVcd4ZlRkkX1pIWhA3rA/MAHykPT73EQp8nu583sFFYo4Hyud72qc87ID7O/viSt6QDMV0q9xHVXuMf1tDEeJd5MxkB6Twu/6kMDIMeT3XS+CLyBSb8MRKlpaJgy73F/OY0JiOZz5HPNyL9gfdfYXtSd6XLs1ph0FwPgZ9UroJr55qgTXOFqXHcCKPOBz+JSj3xnyarFtSHyy4r2ijD4FOxv0+NAYkSTuQz+LYbJ6EyyjYh36swLL4HC7/+ZXCAuTj4UsKgRYIcsRzzHzX3KmB3+jXhu5duDm0qA2UCewK79X1WxJ+1wtM2oz9g0fiWaoteVlWYvGfDgEmUYAImpu7Q19A6jtcJUK0V7VskNgj/X9hEwe+bd/IOAxkayr5fP005fe35t7uUmLIk/h6mRxSOUCggzaOv3Nw3dQsj2VRwLY48OLMx3OJ1osROlqdlrvMJsQ2B5ZXGsgbzZPLWh8Jixmlor7XeFpY1jvV7bWQeGyH4QgcoS/qLVR5V0XsQfx1ZqRFSuSNCqxWRXkoszBBfCinBaqMesKEnygj/wbfdM8887/14W1pji1TSArnhp/F3uxj3RWqrRQ+A7n+R430D0jFJbnKYLqez/0IoNDwWGEFgX30x0t5AHeLLstnsNuMSl9WtSheL55pujpaH/7HQXpKviAqzxJVydSYzT7C7jJNMjPYtiLV002o0J8YAMcvCQF27yncZEUlq02tje5NacrgiqSLGZ9ZqWedF+ZrSaoOEhLPBti0b9/Bh2yyo1SyF5OE0SiQVeNszsEdjC4dpsujvnL6VrS4c71pXtEEfFcfw5HGNpUjUL4bO/ast90arTQAC4eFOczMB8xrdubdXQKE+42dEAPzL/lVVBPvjGO469N3TWUE2KePtVNMa1RjZNsJmKyknx+xqVQWlhrew7YEJ6dtdm9TTGIVnvo865osSTU37WHtzaD8wE7OkmsuXfwD9PLJ/bUgsKY/HD++PQifcx5eR2Dxah0LWjRraS9qp+wV5AVE0qKGz6mN1bSTByIsPUeLtxZsgBYH2XcNuarLehgobl9+NjMEs5Du6NC/V7QB0wGNIYt78jFJLsOJxEXZGvcB9sCEEHfgEUqB7enOJwtahlP4BC00WgkoKUt+yczHR6nNvO8Xcqy/xGj3q3emW6xHLajayfEu2MNWvONwILJMNQKzn92KZ9OCm+sDWRFrMQe7svqMxg+gAtAxt31bPledtCgOpGqZSM+sH11S76vB9FbWQQoxdTbddsAVzrJp6ksVguchdlRgGNU3KhXezICrQOmygCmqqf9qBTWQcFM+YNE5yMObpMIH6GnNLhKo89BF+UP7rhRhV9pqHg0S6imzrPdlAk6msb5oUI9eGwGAhs5w11Tj3mFWOD4fOZSgaHxOhKVNyjLjZZUwTU+sCv6XFAUro0EE9bT+YlwLmpYTxVyCEfmxqKjebahX2/LUA7yZ2Aqa4uywPQHypBTHQDbBOx26Ul5iGZH4F8zjRwBQGaT2xf7O+jpD7bOx9CgF69j7vIwmvBSNNo9m9xfRZRbx4rDPv1IFxufic4MHjnpUavj9h2zq2dQ3nvR3KprM0OI413ml4GlyZEk+ktyMbFqTdK7xLk0WYleplgA2Jjm/wZa2Y3gVOcwH4cAzYJyQzp04t1cnBFCGGLCQv4YgigZ7zkRq2bn2qcfIebeT/jYXLQe35Bjp8n3zj8Vm4J5SC6L/mjjNPFuXecg7x61j81Sxzz/uwfrAtx6+K86oh5xOvyf2Y9LxAe4l8aFE2f385yU4h9pSLxvpbTR6JPzwnvQFD5b0QsmjKI3UvI/tvSJfwNkuO64epeGMIAQBC+eJUHDVoBJDI3lVs4KRUr/b8uBL4QXMNb5uorSoqrKVwOL8dko8pUL9jmVfiowFgTU+JFSQYgnMnbKoggnToL65n8M2PVVtpM5XtU/AFXEcyzyXG9nHNYywt9h0dGuzQUgJOHL3jNJtCGKTineR5gZS+91Fdko7zTcRMUf0PPJUWIT/5iNCH7cacfVTKXbjfc9McZOdVirCvfFl+eTMDjbl57nKe6zI1DoFFitTwt+XDfCtcjQfqYz4FRDk7NZYkAGjdb5EdJ3BgQz4+nqIx1Qw0MwFJOA5KhsIQQEBwYJiYXYSdFj7LGDlMc7YZChYSfX2VTSwfovs6uwQ3vIrd30FazsKd2MOWUl4cOkNw6YYRPgYT9aKb5IpbZxo/hLcpbL11oIesnXYJlyGC3LfGJeIYQNXQrHVrSsm1G00Cy8RVBbZm9++Ww7EjUliXMd3XcOgvdxO8T9igkr16G1+rFk/CXV4ntgKOcLUwrsb8jBL1liiI2dhVDK7kgulhe+tZSMHi80r3zq9SodzN3DI87oat0I2z8WbHIKTta1TC3ldQQMviASPUY34o3l+xyj5ofsys5AEvRAdENq0iOndaYjNIs51CkjaZqil75/AgmxOLb3L8M6UIkkc/WvAGl85nj8+gpjzWr/4TXb7jWNVrncEUDXh/85mp3zjLlglI0tc9l0QgECPlvubwKXu2RM6W/C1WIBX7KAcecBj1pPHkkIjD81R4cftZKr6QkZlaM8vEHASj+yGow6C6GvhvDqBHZEx2Bx3Iiix1CR20evtWGcj71F4IOEdC198GQ70dQRCxmlWnr9/RL1lVjXaMSyUIseK6QIxaNY1oq8bTS6RC01oP1bRmY7fHVnbdlUJ+WgsFRFjpIv9tkPr6585zI7BSyFh6PdHOrhTeYn0cmeOE5WPUcL6yhQ1dtz0rfsfQIgfLDvX9SlRs7CiCk8uweaEKQKPAPS3VnAUEdfifMufqp2BrlXeh7HP+OxPR5IsmaqnTaxJMCZIRD+3tKeE7+e2gfhP4ghjASJxSsty/aPbTtGMk7/MbdgpXr4rBTR2BJS5Jtf3Xo+CJfLsU5/ufHDDMmHU4KLHJ8WHA5IATCMQEq5iKrrTANn7GpDhECYIE2o56ko1RC6aF1M9m6Oz6QduJOZ/gZq8cvURGcE1aYDJa0FmjRlU4pSX+R55Pzr5lEgPQJBBgWhIOm/fePOqHi4TZvbpZXm1TPczKLFKwRECqFyG3SPwtoQXUTG1yxynIUwMEE4X0wL2IiiGgoUgop/f61Ro6enNW3Xh+7DJhUCDfi9KfeJbw4a2D6rh/RngGG8mDG34ElNecNcFP6tF7whCrgEz4ytLfNoxAVA5lGuAVRzFE/JK5OtzNw0ZVuKgikkiLgGVqYGKBzDqyZ6QBgYnYT6cvr1f92W2sr+pm0cKlhMU3ueO86HClBI7uI+7mTejNJd1clUYVe4YtzGog1JsKJ9i9mFyo7akCpfl6t2k/nQBoAPZMnFNdeqhiL+FnlcRXypEhHxyyf2/cIyCxCr130YbwTovDCTSXhM+qj1jG/lxDgpOTgrkcyIdF/vQONWFBC+BlpKxQC7IYtblMt1ajljgpAnjGdU+m7yMj1nNS6fSMYE3EFdGeaN118F3RqnX5zSPyq8ylzpnE+GayMUUao9832n5ISvwwaVb4O/Sq3uzm4Xi5dxF5jdNqoxy4/ENU1JmEq4MJIGRSfgwMe4RqHWF+QuEFv4p/5BMGWKn59aWCcTVlseyNX5uHH3v5eSun1uoijQOTV2tivDFkYsw6JW8YkHvwawp1+azcvIAW52tvuR0ifePcGdiZeqVXNZLeF59M/YIhSqU4BUaau50AlYTW3OzvChq9PaXpoxqr9iCZKZI4Uop4CQ20XIS9hNqA2K5CAugz4s7Ld7DTgapwQkB4VeRQq+LSdn0heZPoYHCy0E/F6Jnxdh0O0+i8L0lMgbguHz+xY2XKiezhVw2Sn/MhmDtEd8CYhrG+24mBT2qPvFlJa5PTlerd06kpRjRD1Ust1Bdn78izXaYBl0wX46B+QaEMm5+4+JfIHLbjfJyMSr3DDJ6BAOuhJvwUlpXn9dRcgO4OkXwYB+fozthu6M+YFCQWa7v+tEHO9sLCmcMmGtUadp+FOzwOyisiWK1za7cXP4PZ/9t9SKOj+AMXLfPJH2kDbsfiOIxR/SImcYJahd0qmrszXbIHs+8nS7MAaAuHU9OG3oXut4ZDlCGld6VHSULzkvu+eml7h2Bwu1c6MpsfPxWxd9LE7es82YM5T+tvLV3C2Bsyg5fbo18T1Di5mZWn2VBTkxuKO6P6ESYfQvZcOLFJwxBJf1PVPW62LLWq7+47w9S6i6ZxzSlDtRvUaCO/c7Q20qGGdMYDOcsPjZgprs6PRJO1bv951uAXf4n0mg3/plkTPVMEU/irS4oglcdO28Crh95KCCTuLhgc/2qGRW9C6rETUe2Eu9jqai1l/hBkWeQmz3vibu5Oe0qPXCk1228Syu9j6Q5sf4yJhiO/m/yx0OujksVmoq97GL1m1iCnMmrHgKJfs6jzKb5hiKTvJnx3PXQca8ubtuJHbc5OCRbklP+Xls7UMnRjxpbVtRu/PvS4IO+1gyp3eNtIBJH80ohQXokn/pu3pe00nJPn4vPKjP3VHXKCxLLHmvGaaXe6niV2rC599JXVX4SelLhQuK0IlqPdVtJu7moa8Sajt8EOwuclLccGSpu1qLgOXEDcT5OcSxZwkuELiiy3jPiv8B44wr31H88Q694MAlaFfCbxTYt36E/UiOcxKMkxzRX2VK+F+M0hP3ghvrH7/0Eaqufw3IOef8DrbWTCMQDbJ/4IGZx1I861dHzzctV6uJQTnrhAjKwstZK8AhbGeHUqSaxVYH+cfCWWHlfWI7nxvCfjYL3oTg3tZjLrps0mEwNaDOtVqMeaQJvBXMfdkvh/a+pdd7DVU0iGj8LTZ+Rjl5XtQU4ohCZHVasm/xz413zBm33FothfJ29fmmcg0u9TAJ1wR0PewzJBKByb7FBGy4m8UQ1wyPstGigmyvSvuO1eeBtB+R9Yq27zz3n7RPLHZx//17q5/VYkThpPnPoCHWPaVkd2sAKYup3wYkxCowt44/ZseglU8V92MQC0grp+wVsfV5KVRzRG2C7k8WX9KMSpviD+xGl8s0Xfw5vdyXydZobwfkkP8nk0EIAIoHpeNFC9sS9mLphggJscHDe/ZCr30hhG0uBX7PRZNXfnia41eE7BQ7SZNpy1OwMN2LSWsVg9DwZymr6cwyApMU8tmfS9F44PwxlRaQg8uLF91Ytkwez0hDJW+bkXVG67/ikxctBY4rbCnKyJL8ppVfnnZ04NDzK+k1gu5jXY1gCh80xfPBJoHrNIoFhKq1FQve+hQiDqNpl6KTjEukEoahvJVmcLURfFXbMMDqDRGhKXl0zYG5ykhl4wgSQMLw8WM2XyjPcti/QTi91JNChFihBt0U3qedNxXfCVfdUm+/z8/zCmldwnIZpQ9WRU4Xgl+kBiYoQsvkyGDSzh4woiuPFpzgaKxbkoDBalAHO2U2lZavZ4ybGpx+ztFznHVP8JU8hgycJXymgzalsne7ryu6OzJjf4ncCnD0HFbU9MF9ol8lou4zetMLKIqfCE2/inkWJibTRXIhwzi4fnx0GXoHe2MpeR8x0uuBZXUrm/2J0E+yTNOPMXelbqPHY/yjmZmXPoTMOnMOQtjMcC9ZBZbuB1dYBTCfej24XtdA8ZPWOwSoRC/xL6D8aLVFl4Xd12ofY8yUJEidbjKjz+RWL67pI0zOah9m2K5TBjUL6kpSdwUg+Yw91c1FPMu/nOn0INtY/vkliegV0jW6Ajpg1gFLqG/Oy7y+vEVB2/hphbrqsGefjnEyPX58jLuHlvKkKos0BxKzVCP/rHVAj6TMt5IMtRCyLeKsT2PTh/4k6t4lS+VK5Bdk55ywpcfenMF6Qa4cqbB9FCINdYC9/XtaBYQgBoU85QgmxAYxqetTl+Dt234VWBuDpy7vc86QYHLDqxkSwlb/52gEi2zIMqhu8CxRS7TB45xK/3fGctQKhBG+v1OGoMe+P4c1Fqwk+CJ3SQrWKa4xwh19BepHeKDSgAVch4rZKaSPl0vIf5Dd8MZ1zYWq8GobXfQqPE9b28s7aNfbwkfRAVHvgAUeVudVZiFWV9Gl3c6Cwc6MG+/8aHGGMB+A5jk9gHzprf8ImAnW6xB9aFF6/gyxoMrKnGcifE5IePnslHq36T8w+L+aCoLQJBVc3LxxT5tVswmNYN0kvrMWjdKL9cMNn6Xbvjog9P3Cdh4EwcryyZXnxZEYwoT0vTChu1QXxONUxI56FQWKXKujqra4ZDFYo+90Gac7lSDfCEntRDJZ5JOASdYhJGNMWLFeQaMN2iFtr7tpEzTFaB4uKIk+/ywOvpORckXQWAR3I7o+eyLM3OCmFLx0rpq++09FqrYMDxd6eAtDhLDXNMcQevJ4bYeEeqQENrrkxIcVpMHeXsGnfuLS3bXo/jjwghgLRSCpOI57eH26YYmK7+0gB7X7VRRsn0K75q6dXfYR7dIeuUdFcEgvMJTnmpEr1Z019/HfmPaT467Ms8YeJeqFdZvMsmHgjT6eZt5mv8N4uHcGAFaIMZ3gJfKrRR6vHVfn+hP+Po5HCubpLq/dGtxCorFDL2Gu9MY/Z3PJUQSshEqnV7KZw/RHqnArw2fwzwE2xB0YqbcX//UiGtsiFpzM4gMMs24VqTRKahTI6yW9ntdm2Rpobz70+Ic+wDYu5orn6CRtylaeKfsUSs+3yfN2zGVuR/RMV9aHWwwprQzfkXUhtzmL0cXB2XqGV5ozzNUdiL9jT/RgXL1LVqSk+/4g/+rsfqCotB0LJKB8v/yYU+As6tF9hufB1I71o5ZyA78YaajULggqCPIU4BDAhjmmhFVVJDlcZxbs0/qFryoYJQwMAzPz+Uo7cDX/YRoBzQfdZi9skzqcu4bk4EG179Y3N7MN5wtsnXXho4fgghUWvKag+b/N66HGW6dGiPTsfepON4Bi5NXWv6ypgL45Tuz9chafZaCSld9z+4LTzJ1CzyPQGmqJWQShbetXUgLlWOZOu6Kqn6wZ1yPM4bykPKLm5mtfKZRDoYO6Zi84mccgp4sOBg3MWzm+ufSdLch5bxIqCGwlk4HARJpCFlfnFzv7yd8hqM4v5Z3kLV1OmBhuRfp3P88m+PC1WqynmEFELnruPBclzYWpBEhDz7h3Kg3j1zMB7Nhuola5T5VfqudkeTm86/MIyJL2WWfs32M4zdPFCTJFUa/q90nGWg2/RYMc737jU14d///4AWVRFTYNc1HSZgWONb5xjZU17jU1QYtH9LWNlfF8EWI/tYsoE7Gvx3ihPYN5X7SP0qSPRh03mZDqnIHK65mUdK5A5m689q7jRJjFOo/V2saN5CMu6bheoyZhuczAZ5OJmPBzi6YkTaoALIEzdtGiW2WhQFPnAmxrMvAWABl5kfWgkflpxFB8bjDw40clP7/IGydrXzrBRiHNpPkrsbNVNWdcsyg2wXEJSVMXHX1VvNr/DFvbPcNDhkY1usEympPl0TgkWBPHhUHoq1fGnxtUvG7ceuI017ZvV2Xm/U/sGofoQ+6eddLM7qt2sTi+Jpm1ON3OrpLJOAeW6cQjmAAD+5w6o/OreVd79eqW3LS/4u2i0zDpaIACxsgg8Lkk9dqXTCkZHsS3XqjXM+PfuPkoBKGORLEcugtbi/64S+xgYUT5ZeOTqlrpm1aXkiLmanfp+uc0LBT6LM8NnaYJI+OBZYPNBpzJVAmW5CWIFVd7trksfxMWQvxvijx99nK98MrnGhhrNdVh/xABm6hyJ02ReGDPttXWB2JdymS1wrMKz9RRC1ZjiKjroUCjbwVF+3t0I2DebmJf358brLwYRCLgLWvc2bnhShD1THEGO5iMSmQerUrp7KkoB2Qjs1gk7wO+TvEKmiaPshsMXMNraPP+9J9Sw4/YGTGJYHyjdE3PUFeu1hSz+Y8SagxTAkX8FfSpT1MYR6tRmiJw89uW1aV5E7CIsxxg2BP++8gO+FhYD/I2CjMLL1eEgYXYpTfCvemhLVtfg8dLZDePZoULGwNOrWJBlyo1U6/51dJdd9hZdDAC7rbblm6eApXGGe0Ef8H3ZiXlKXmdEBZZPNQzTd+WeWv3l0pekTLoRa/D7dxzgbICG/EVSkyxBhweVbXMSy8Ghw8t0qlOa2caIPbG0V9MQz1bD3crbUOmdRv4zt179ELf0sD5HetdpMs++Ue1f7BnufgjZ5HRROY1b3mA4+WjB2Ik+PaT85N4Bl8kaqoVsLZF2hbT2M7QMQFUrazj5ZadMr4GNVqYUN42JKDoTXr8Nq4tagiBh3aDANlCk+GeFXrxlpHfTsIPRHsFum7bI7KHfo1FeKZ4lx2RcLPWh/DoQf2IBi7ya4cGjjLZUQaQqO/YPt6wrWRd3NLhe0ssSy8de1gfM91/Awv525TL4XFA5rsMZUH7ciHvhG9l2zZMFe0vryEuYrdempIp9vfFANKK8F4kb+yXm/TuXXwB6IGF26+wVMVNhzlIPa9I59k4fpk8H4w2fJfZQMiGGjwb5lTwg1d/nf+0mZHquysPkI68vQTCNEgkSAPIehERNGoS8IMxLQ7+kzPRBeEbXZA45nXgdpAIHDszer4TriYs6KCcOrm8zIRNNszyYmpXuGm0JyzC7pgK7pr6mtMrQfrfZJoRu8ultU5Cn9kLxp2HQNIZFuECHl+Yg4TymQYBVEQIM8olsVxMhtwkp8op9qYogq1AkUYhaO0pxiIFYW/OsWegiTBxKNecmQRD6aPMwOFwKQVse6vsWw/J1mQutRQ+jBW66o0EsPjeE8pecT1bDOlP7fCgNm79sy/c8YCIIVM1yQ02o3UxX34tzQf924iuA5lHHsdTAXYV/PjnnQvZ1XHbIsG0Htt1Aa8bC3FNNAvs0n+ubpo3rD+eiMDu5zYJWTRvFqAG89XXjhcUOOQ+LBSJ1DwvoCvdatwF6W4muxfCjnmNm0tP2jxsRcKaaPUBcpEAqPrzyt8giDRejdBV1/YqrxBs2wJkbu9EDPYQniV+EOlQnpup7Dwfo+LPtc2frXsA0yfeLXw8+n96zQKgdJr7dnis7PRFwey9+yREu5FwUUfZSRgQwaObFCBYZu6pzBS/YU8b0vZ5TAUmBwjn+7tvhrI9kgDcbK+/zyiFOhjfXQAX76kqpZDUzDqnLtSuSVxMK1/qp1jvv1V8SE3DcSkTfm6I8xEDyTho9QWxj4blBQTn3ERUtF7hQ+9miUan5br1U6fuEUPy1j3ZQh05mnVBnEwO9JU/WC0y4N7WVrWKOck55O98u+HpqBCJ5+HPKvfjNnBRFQC588TDWWy2fNkY/Sy48MlvsQT77dui9Hu7UDQIVI6t95BS+TkC+F5pqUCaFRaU/HaPZAa7ghdMg1QFIOPBl9oL+zSH8F739A6bazxRcLpQVkFHtKx247WgyznI0Ywh4eTS1PafAl/RnnL7jM5aUdee65ehip7+LAoPNdOJpyIf8L6C3ZzlHUw8AtK2InA7afxHdp5PpGZO4VXds/F6OkQs2/XaP5ROK/bTwLXyMfXmYieGI40FBzt/AnOCbDq58rCaSvzB6HqrRKZIk8UglascA4DzMIRGQ4gpWWC/nFvmO/dvBOOgdiP9t34iB8dCoelVaXzK3EXu+/aLa9UtdHcQ2kHGMsQb/GmQvwU7Xej/2RvTABE/1dH5IJI+xrjDvs4td+0uxpXA5S2sI5d/Wora9Q0QN7QuciyIxA+rP+oplML7mehtorEGFqfoYUGegkGtAdVku0BvJXQhGpKdYZP70WxLtcaneQZkzYENOTZGrQH/EqE9e1a0BLoiBI1+Ib9TEzG+KP7Wy8c/qbsFLTST8noan5D8Ucc20TAySPCtqEDiWkX0DFs04zNJYkj3Q/oG7d6kZ9Cy7M+84PgU2GhT8lhHtsGFCgGhbWSNIVBg4uWtiTl+w/oUYfpJLP/+l+JF9XyUjEoi+md71/Ezu4hrbcQMBMJ57wuVYvtGjQdAwW0Zaeym9Ho9LwGANCyx9PvW3lF2BWp47EGYdbZogezQn/XJ0Uo0/cNGHyQrsB00yYGlUI/lU+xLfko1+78vUdEz8V35WXohoZkJIimw24As/7YKfptw5xNC4VH7x0OPMLXYI6f8AvVTOHU2YS+wmialYrPTsx5pYIRwLIWaTH5RVY8wIbZN2Kglc+buKZ/mlxz9sAwYWp5YStb9cUqQAS6Y1AcM5AHyKCeR8UUbgjKJmnIfKJ45hKkYvGYRhw5ju48xKNPOQPD5cyEfcnugT5xJOGU3/i2j8XlwO4TeAShOHT4ll24Uw41DgFZwpISg3euY20x5girLOzGMPYG8pPuNvuHsSPPXxWuEkhvD8iOaT092fxZez9CRWU+TLDVav3yK2x2A6UQgjgDPz8ZSMAgmh8KATKJVx7M7sN9lQ1CazazKfoTqeJqaAna9GW2zCPgZeVDNFDoFYyZBQ7q7Az+bz4X5Bve7Adfj1q/+zY64w7h16XpHk5rfYDF0JFFRBbkGV3W6HNQpKeVUlFOoaEUdsYnHbQ1ObWZfFEthZOJUIrpOGz03vzFdSH9Iyxgt88H0rQfUsl/eC0XmBKAmv+zQYwvqsRVfSmdQVO+0kH2lG36KUzoazx/wsx37pM6scCkXfb1huWA1WiJ+mV2Q2lCNzr5IIVOnypdcHEpu8wMaN9+1OdryQdpwYe9ZrI3iE+eWqtmz6m5GFCD41fjjpQ3zPUfxlN0PaRkAbHuYVZzDKNfTQOir/ejMU7YuHrsdc8PxqEnmvWyLqdcSGjnTaIEQHAJBJUseGGoWPUlkLq9iZ6B3LwL/Y2Ssm9VWndRy76ctFFB9wpa9rzMyBsWMIsoyOW+PTFsPbJnDtL5KZ6BiJJrG9R0NC002FZ/QRkl5y82rCMzZ5Ehl4GADhywCJ6/Z5QZeXz/NTJaDbMuuO+NST0VdfxencTk7VPz3GNJxuzIi8Gmy4+8UsZdMqdS4UxZB9y7i4m5HSy2qtJRfiZ6SzGuSN5qXoSnqkc8hqAOjwHLHnafOG4mPhgR93FspIFmhG3eM5vLlHeVXY32zqd+X2tSqg7MwNILW6de1rEhmNe8q1AXaHSfpElz/ryqFihpn1DS73law82BiZUUaNXGBovz0nSAzmQlkY7ybP9toDGygpaiSK6CRku5IOhOwB37Xsn7gHBoydbMydVCjD2/tRsOJtpXibCUUYt9t/6Y9F2+6nrDw6qE+pd+ObFpF+fBFvaO5Fi+50p8LsMKuhfX6OGOS+soCZfBan0LzVSDaLDasMF9B7XyOIHu6mWoOxtanefS93A30fy6KvNQD8DZgMR3JuTcwnGGR5LnSa7njJnG3GI3cdGRMyx1PxbZYZoKdXfIHxT5c08GUC8g2Ml5eMoESxL+HKVrK0Kgv2Qerrsfv9MXD09rbPnE4QDWjfSnFchs+S564HEd/Fz4g6hr9oFUEKcRKdQOzHZkQFasHYBww2qcQgsVmx9TrKPoJTXxBsBYEOWhAzbXm8gcAk9UA2B08xlxi5n2NwKdyVS4FhSUl81pZWnORDxz+lN0hHeB6M2mPllrEzUKiFxX3+kbGWfE3MCjaabtv+7u0I+R/7zrdY9wphgZ6grsDrCMapxN885Q0ITyn5Gd5XbfPlDcUzlIab4dYLntzl6rAwPJbAesRQ85n8PeHz0smUawH8jkPA65SoRI/m0zDANZkhCq6vW7oHSBWsvc+SIn1jziDsXyx2/yXdPRX6cOwB8JXtroHBOIQUqwGllWVucbK4/RZo8JPW09+QcOCnMqXKH5ca0PXwZcJm8X/CGqZ7170BHJKY3i6kgcsxP/1MNWlQrXWEEsagNxOkEtC3xNsrUKM2bZMUIqMJK/8t3XBCeCHzT/o4hf7gzxhIdqa+GupGA7FSzt7Vj5aqWPmM2mMqzf59jE8E8pgav0Fo/5pwDVLaW2pyPPpwdqo9MATMYP8FXfdctKxQK2LWWR1m3Ks8Yjge+XXYZeY4h4+3zkqykiQK7E0hNXvEnDx6lGc43xQHQrWoqL237853DyfaPDUA3tnBIzhLdxG8iiFfFCooSt58kSA2KfihrFOshutbymErCyiNt+r/cx8L5NHylF2cE4WmJRWu/ZhOWglsAtbAaa7Yuz1BkcdS3kcHWJEoXYwKdcrq1nVSMIuzkQCzqaIYmpyD8lLzgci747jm17Bkq0c68OJQL5Nze0hO5B5LscnCOsvUctgzA2u+OANdNa/nMN5KHB/YSJhd9YXONyffW4tE00ZFRab7MCF9+1krPcOdnY8sP3RnTsii74QfHMhy5DVKnLC28a3iCWndyUvU1Io4asAz5wHpCkVauRNOJ8EcpV6FUPl5svfBlVGOCn3x3gdiFuXZDEKoQ/bR2vXUYdyKadyujV8zNGBsma909m0whqmm8cQlFXMV8Sl1K2yZNblG06LK7S7MCyoYIFHlg8QMQcQm930I1y7XwaZ6oH58wHlz6oOdXpi9n/yv4tACnVHH6mkGLDaZflkeJOZKBOcnTxP2ASTAqeS3gzTDEPHJ3svp+0p3N2/2Iaql+JuYBtm5BoRSowoQq7u8BR6GPJ8vjkepI6V0saQutS9rZZfL9gi3rDtvdzluOh1NHXBwvwucGux/GBWATAEkN+rikDdCVhLU8tvrxdlBLjrm4GfLuyfv2vHpU7cIwzyzTntNKnzHxq4MBYZQwhrge2AXyjn00ZpQg/aRVupZ9zQwCklydhAIKuTysDUir6BmjShC5tOwqZH7hRFQv/gWP3mRnYiZCyluwz+NCs0nZlcvB+HclPSeIFBxWO5BR/vAH1Ndkm9t7U9FrQoUUoCUGt1SWFYuWjg/mtRLr8Oa2BMUrkonz1u/xG0NxTIV0du5MYGFOGeckm2A5VchoSy5uTi2jxsFglhjQ2KJTnwjA6bPsBN+++EVkAfBVU2ttWpDSiyzAWH5dOjZbtg4u6u5vd7sTixPEYBhmtNxs+XaVDr2u6A5eVABAHZkjrzc92da0qKbNX0LdETBRQcEu25TFPp0zukk//O0LFXxJd1+gyTUfaXVBb0YQYZfepRPZDR8ihtzlkGrJCWKPiWfUJWj9HUmIRZ2LJBazALSFC/b0hySuWWP00uY86Xta/eXBZ0AjicSL1lM/EYbEOcVYvKMIoaKSN4VK2ysunDnPfV4px0151inffUsQy6lP6ikYAbncMcULTfmGdiBph17grOL7GnEjuq1AKc4SN9BrqwPhYicPSr/p53Om6cU/3QKhHDBd+mp+uZ3jSMH+wT+KYys/Sh69bNwG1MB81nJ/ytEfKheJVuh9YlGPe5zMkVEFwc8uqJaZWxXSHD33EAlfEkdBzm70j0rtwQbLP5mf6CkAhVUpTyMYfuJD7vgyTEyTXh/VGxSpU4uiuvfi52aWBuWHpmYSx/AkS3SDxhLaRFbAzynhOESErTPjcRQ4O4y5luEJM8YbgeppoY0qGt2N8vVMoGBi02weRlyLPvphphojIv3afoymhOJRHQKBuJ/Bj5i6zSX3QN1yeLTjNLVj+knN6khur6SjCUZefyuL2ZfZJraiYR+woxTYyxEroNXyLkoZu41tgzNAvYYtFyAs1liP/WeYK1A2zI6kB+GaDz+fVIIJLOHVMaHrtyFnstiA95R0nGT2QgbgQNcbU2R+t4lmXft2iGPQPI7YX3B9ejN9p0bjRLIIFWpoaDv7Hyqs9NhLC0+o8HoX7EbmHAkHdkiwlRSMpY00bSRaW1Wpth49WgVqkHZsY0feaV8/y3GHt8NdReSgqDa1E1Tj4eXDm7h0yOCsjnIiUQvtgIq3UcUZa2bhyJeE2CyRfBREvkwS2P63BsRCm8q22n9pxdyJg5bt6azsR3vNHZoe9vn3f6lbEf0nLb4X6ByJ8Nq2gMrHO0vFE2i/OyAxpqwdxDua4GQsI2LjJhD8/IfhSZKJgvsitekiZZjoJWLQxS7W8PnRqV28Q8zdLcJ2SYmRbxiRxMlsnJHxcsgAIoBuTaZoYPXVBwvdnh1eegb8jgBQjDlJQ46vgtkSl0QhlJjmVi73kogVhKHTjkSpFwAn+f5c3nhhbYH2Kuw0bh2eUo5HNKMm0wkSQWBzRacaEArpxUnkG+FfYpORP0PtayA23q8jH5Owi8VssmeZJUnYIto3SuOyJm2HWeOUFvwtyQB3VhrzoYhsGHHQyYJtD6u6uNynz/0LKFz0hgfpG/3otwQNB4WBMV+WcZDEH1cwTXsmZtsfhgsLsS+IxAWnl6BOmkzwxA6qo007lAo3aYGkl2jHlrc2crSu9+CKfz/HmLefJSZr0KAd2PUGj+y9Q7oeuhVuXPS3Ut0p7VzFU8si9lGJ7i7cZlt0M0imZrqqTwxSsEJNXPJLn1xRQbfl4vsQ7wycbWjBCDQfRNF6cSLoA5uTwqkS8/EctKVwBFvzLL7JUJYL4Ga8otlttLazDCf7Am0Y2ILqXOt4M5SumS2WE2iyZBdr7udiqhUkGB7zHJU4QfedUnFEYcdm2/lR3HP7MBPfwxCsXocVCpxQkNLlA9wgnRJkWxcd7Q5xIZ5sP/FaOiKnlF3sFn5Jna+az7bnLpTENVq4UEj/+68vwn+PjZahRRIvSEtSv+XaPIthnVcXpBtpy7AAcg76eY+/ucHbCip5lZ78IEpZZ8K/VfNnZAdwpgQtqxZBwz4uRgNqulEtOX/3DdDAsZ3L6pO67LzddpPMujPgDf0kVQBNVrf+7OSvwMnUuv6JYfmfiOl3YefVzLFElOLAsoglO2u3ylPegH9A3HGnFm4STeGQBiEPGVcOI21vmEsKiwxp8T8dPsV0P2MrLeCAG4ia52kxmUyMpx4ojBiXh/C4qwtpEgJLniaorsIOC5bTBdal9C7/8/XHtdNE0qszDAY2Nkyydtbpgnp9w3T6saR30dSbwV5/5dWVMbi5QI+6Z3/autUpuW7IfqmrDLIdWzqFR51T89rAMW+1pyywGDhjo4xtiygxk48HM+/A61QK8QmlTjqHPkk/sCc4x4XvVruVAgHcLAlXOMnsQlNJk9I54GdqsZhqpPnY7FuBkLQOkMyT9boi8t9GDhF7Pifj/xhfOthuSUi0DqxJ82VfUn36whWrjgDRiaOjseU2eUCyQePf5XO9AZI1xFL+xAuV9vIgKwx3m7/2ytQfPBZXVEzjNSv4uhqWiYTviWD52bjQe2dmTw3fdbTpc+q2RpoW0adRjbB8WjJ4iPHQkRNLQpxBPNqC1S+iqcK3TWsXRD1fE+sc9o1rMnky3uMuoN5XO04514P60jLCV3gYAWcHvse0kE3689QLFcnwBwlkEPAmsTkknAZQBfHIRhBsCuCJGDHxjF8qKvA3V1OTbONDbNoTrlhoUqYBw4XwR44DNxRuCgdu+HINMligwMRjuXgygLCM0rRe5NVcqqzjpA6jc+X7exPFLaCOrpQ+w4c1fy69/1ykpzFACf3CyUffrfwHWHtZzGzjHCstAe7ZzUkb2DGeSLwd02vBulNfj4DVHgKlvrjrGOgy3+M5e4OwqyhkTfBev4Ob4HGIhChhWtXf3k2sw3NNtp1UlFsLLr2DpG6DeDc+2yy6VIJoGPaDwuDe1OJ9/FrKDQ7+voUhWERhds9UX7fZLmye7uT2PyhxLYBjS2SXsa71fML6BZVFoCUdvjkGetqXox+xlC0f335pkFO0FpmOD1fMnxH3QhewENtl9ubsySwpahy4jHCQcabJDlrQ72ijiM2UZUGQl4YIeERPovpCW/BwU58raFCUR1RQOt38V+HJHFChYdGMqfYWyyQTqlQIuhjXG8ZvJtW/XxCsSNHMmqN6o7aAXgAhbt5NlRNMeWPgHCjI6Pg0LhuNCMfKNQyBstZyr29wC82UdAGvs9RSi0IkcK4Fja04WbXkRYxBST3lQkpt1QM8FbFVMMvx69TyBZe08bA9d9RCOHO9s9CyxY7dDilhPyJNGXZM5wh4bldUchEg2finY5zvzJ5O6EmXentQ02JzbmhfD9fv3foHZtc3BbUTHanR0uqsz2F+RVU2XAIc+TiaAdEhcJV0ijoFVmPIOyOo23c0BIHfXsUVYW1PuBXXpsJI3Uhsl5zVyC51zwUF5V1KXBhq18cStGE/sZJGpyHZmzuVspilOsIV3zcNoj0fuFeKrPPUzy+gFA1rEhJ2e3hg4CH/EKYhu7kAmfAJ/G6dAFa/QdBR9kOTkSD+2cMwlTP+gRh/cHxOrINSiOO+Qqp2owGbC+b1T/mCuZlQO5sEwy7AcA9ruvH/D+p7JDXmt57CMJfAtNqyk8fCAac0BkGrkOmIcOJXavf2MajqZ+xyLnqjWAy7v2WUeppIj7oT1yoicXxpdqOSuquCKINH2osnJgi7ATasQkqjM780KAdmPxVVXBlxOjvvgxwxZuYHd1gPuNRTiTsrkJVvRxc2OxXajbEAuJbPtec0lpjD5TWSnFXM9MhBWXu/Usu4rl0tYX891/tHA7NtFa1gcrAyE7VtHgab+uec0CR0iCRz+6X+nbXrLVryEOpAzyGmKofkABbhH3kn5gdu7OzI73/h/GpGM0Hbd6GuxNRr4F3mk5UkBt0MDUaL+fcavF45dQykze/z+kqEFQNO32IxHXZ6UeRZvCpbLTo+z2b/vs/dfAUCqJmnWQqNKGWt49idGLV5cqTDPhvB7JEo++FndXFry1iSdfIqBl751UTLY4g3FPLDdNqLQ00Mls9BGdmHIQTLLHkwIv+LaaIHnqNWkgzjqqzUOSNSN/KPGDmfL76KKBNAUcbYVveQ5N5IQmNzIF+Ql6t1kBZbkzPiGnTTUlvst+aQyaCysyJHLJ8HevjAStLxIRZaGQRGx+DHBVdFz0LONZJNxm3d9tYASQqXRt1YMe0t/UMjQWaEEQzQ/dkkjFvT+Li/Ap9C5EAEWJBrOkyAxloRp/4EO1N774TA9y9s05q2Vu0mbm9ewtY4s2Ynv1ygB3xmWgFLOJpdiF9exyzbWZzibfHSbHgpgd6JwFbTLRmMyjAeEHA0RIDzWkduHWmcbeRSQhH0qCCl9f4g98K+CaQzSjhMIXZl9X8R85uLYqYZSmPIkAn6sKjiAeBVWqIONsH35eFp0+clvLuYayJDcr4o3FPwUUYqQRenga+igL6wQ82oRDrgUBr8Fy0JV4+Oml5kux/VzqiBEGMdEvJilYYpsdZv7lc5VqRwDBEabvJs7sY0g3a7a5becPbF/X7DQ6s6eCgjQ/QDoEpJI1y8HkHyYykd1OI283F23Nv6LUPoAolhbLrtLrxGVwc3KJAnPTblhb1+pgq52AtJ6SgYrmC7uR89fixsP48XH0R6VlOdNngJSTFHJxNER9zSnnkIfFMvvNqYM/ahvpQdyJXpedkbom0lP7FFZwerpdSP86mYqoCGKgHGLbxgusgMzOweTkw0d3rhnTlPYn+lNUc47ZqE3tP4FZPyc8fKfZKEwDrRHPGxSIftuRVMpGLXnHOp+XBu+wvr+gIk0sQ2/bgjNaklPWwf7e8EXskBdRe/r7b+reI+SOlRJBuZ7v3iCfIK6/Rnt5JbUl39OA2khPRpVJTRn4eTpFA/XJQ7L2vO4p8jQZtGj2a6UuTcKJOfx3Xlo6PSx7fTbpXjB+tkn9xB3JcAg7Kan7DtS+/VUV6sRE6BhEFkyozyzoDGp4lD+wWG5BU1pnpcnyFBToV0J9aSzvCG1jvl26SezlvSlt08ahsGy5vYD9dnTwZvGq3KVJ1tn/ZBygdd0C3abCX8XasyHcs9UD3DUBM63pOvCbMq+8jeVF2+7RaUc52t1q05E732Vq6bT9px5HIeu52m90rm5qKXVKFPEDMIChMpjo3JX2baemdKTY8K0BI31UEc0MpbevtBh5YjYGS/jTbslGpNaCyjWnO4ARb+uXxI5oIJMdFdtpignRoq/arMyT5//Aj2a2iIKS53p6Tzi1N8ubu2uYouPyNLbuhEoPQaW+MJ3XkuseigKBTZ5f7vSsBM9TUVlal+zP9yZZJGdEEJN2tuA8Rw7yuIVwg386jj20A0D48H3CDlTelO4FEh/NaFJil101OlulzHSXwS9CijP8aWaR5ucUrb+qCyBEnZ/I/u2VuY9j2foDufqWD3zTm2ieaAz9oHgMO5wcpsTi8hrJPgeS4YSrj+gC5OJCwYuIxUtQXKkBlJiKYu1WOKOZorRl9MsfoXD5rUHew9rWCAgE5MbrgtQ3N3hIeghJQKntwqvxyvV08fyz5l3VzjuNI0bt64K9oIXBBBl67krT6uGU9NIIGF+s4yE6zwdNyQ5ILvny0rGaRIN8S1ts0eewsbTYyvpJ6I/bdukUfYB9ngIZQw0R/wP7fOpyIpI4qVsUihbLQ9HdSPWR1FM+LK3ajOlk6KFvUZf1Id02uVffXVWx3te8uBZUJVQj90zWqdU5CkTkdmir15jd63pTE5XeysAgzwh0Gc0zN0XNXnBto/+/s2+GKoZGD8vJ75Fc4bjtsdfxv197MJG76fkZsagI71PsHL3ok7KNVVWICyRWS4sEMdIwyXcwoQTKAna29vSSGSbb2niHhFXafzJpZnTIK3f3HVmlqCJgVdXtYFV4/1i1Y7dESTtXy2QscCiGWQncmPeixZVk09jL6ahR9h8DCILHJQPFr/9Jt6VnzhlWnvcNC1dEXdfNQKglGDLBTo2KWNCQz1f0RYAqZ2dcjWPkg4om/ip7V+S2Bu8NT1O9xx47HD25Av9CfmOS0IW8oEfN/ukyiCTW/JXKzLALROZT1l8D8Aazi7VA/DlxuGt6sJX+6JQE5/rrLPq/1cEOVrvqleaYfKZ+9FLh52uccluOsJIOmvHsL1lbpxU0uCg/dzc5d5giBQs9yIqywUv6koQlktmN52eOHSh9NoYZrISaQNmuI6bmkOw6XlXJvSLYytMTFgrngybp4x/r0DCXuIC8T80gJ1pjILkYfPC6Cv0+VmdLmCRn2ieikV9f89gbG5D5oETJJrMTHnHfHRRfwp/fD1Ee52/LuNAXI/+mo8iF/VJUGLBzuMuyxKyGMJnYjlkxtmPIqVmW32msB041n3RpYpzx1NtAXdPNHFB7lcv3R/Pndn3KnKOWs9S7siQZ+J4CYnsB5/qf3IiaJfMmgVkINV54Vz9TIdxiv1+McDxWMEnQO6s3MGc1dWfZIDUMlFB1ex+766L8/uaExFMduwQ5TvDauR+2jCTobUotJFc6ncqdKWhjqJwX3GkOqx1m8Z9SFzVfOAz8GRp7eTw1qkEndvbkKvr2dHzjQNxxvaWnbb7vE1ltcCaf32sAXGrS+bY+jbMxZ20lbr5vS9ai0xMKhMU0Oay6qxIfiv1qyAPKEKeMU1/igenz0vw8+8PIaflSM3O0dsmdUmzllZ5PVe6EhBs3wmNzLw786VTlMOmEkK525Y2ny0R9tD+rLkGKX5XTbOJS0hKUXkD0tlseGakGg+1qBz1Sj9NBVKtzrB8r6hBe+fFbqqvhUTxmsUocj3D/A8sRNqnXxdcr/FCxx3IGcInetC+ucyd8a/sqkfAk4HxOvsJMu/qOORwb3+qepezMpw4efCiG0CQAmcCSrg7o/soLK/V9zLELzD6CQ9iqegVeUgh03bZkGYGbx8B6BJ5LUiKjKsHMK+y1Xi3YFBOQfiDgodLXctb8usAIZeFvJo4AFvXDIB9qV/N1kjkXdrPxVOAU+OqCyeHaLPVOP0ajBjI4LolVlQjcphU5Wj2D1QNZUzLeFakEz9w4YMt+gZNCtyjq6+M7yj3smoqThkZgE9MbFOcZQ2hL1a1zt03nQdVXoYXOl0NfB56loyxRh+uSLcMmY8sZOErbA8f7tAsOgKqk79K7ErCZH2ojEJEk5NC8fWKQEDa5nJ+cvMOW7T6lm9ifHGZZ3QPDaoLOuUjFxRAIHs2KeHa9koYmmsXI9Ug21ooY+P5kAs0Zl5WfCUmCL9p2NjlF24z6pUbZPKlC6QE5clFt0zujIRdjchsSY6Xd37wiEGKPiIT12S48Ho7Rje7y7ZSzdSaeHRcvbKAXe7uBUd41cSIc4drHvkxZLpwDHis+AVbGJPzmzZZShwKYgpz3ogz0ztPV8qbVOqtEhP67JSEex2+p5xUnQPc0iRgbje/9oEg31a+lFR4ZoqnXEehSLZeackOk1kLDnpASJdWfNDeE2wL9jYua5M3q01cg3EZEZEY9hW8Xl0u0EX1EO53SF7X/M5/TOo+HFUscRBfEp6vLS/+ECQ/eo9LoHqUW6ubRjip0N9rXE5XZ3tbYxiPARDJMt1sXDgpwHSf5FJZD23Uben9HSQpjsPRrQBWnjBQXzj3P6USrkuhUiZnoQiQIMxRhqTyq0bUopHMnfWzH6n5cBkpzeJbXIFhqWYATMQijmRVX0IEGtV4+ABoSIFIwH6fTYbvrrD7JXM/IhF29mS/ZptRMIZzSrxf/0QLVwXIrct3y6Sh7OaqdORjAbZbyBPTgh7xK7aVVv7qfqnGmE3ZGt3papNf+3U2nb+vprRiBOt9A4WjorXJvu95cOeGh/inHgwjOvOgp66Zp+RRX68Py4WI+HSFNk1MQ5bTBuHk0W2UrCsY/sAn58js2MeIQKqaANAunwE9gM9VISVnEUkM5zz2ewk9B+JHj7Pp5uzQs2ROOeczfbCrnavmcJNU37B/O+nL4QkDoDDjR6v1RaHIP4HA8uTotpm3NkGqQPWh1vb89wXzJ8rvJvJ1erJDFToaROQ584d3OTa1ACtrodNCk48SNIgOR9MkAKd+Rl8ViFJScyYDXN3BSodpgLHkgnUTEHXaVFNeEjIHKbZSLXLHwJjKOrPVRVVn6A0/zOi3T3SiEgRCdGaUi3nb7KMyTl9chU9GOdJtGsnRw0og50jKHrXrqQUGH7fBjLxjObMHD+OMg0zgiQ3+G1D1QrBnpbuFKmXD7H6zezUu6qcnShK+Yaiv11jtZmClmRHHhFoaeYfljfShIS+PeqEW2BcrH0sNls0Fknv9ZbryD43Yaj03zwJXFO1rb6Xcqq8FiztJbrX/HogPWLKfJQzH3kTUPa44X7KeAxxuaMzSRkHtsJRKuMOlcmTqaI/HzS6wast1/KF97LdnHxPgfW6cP3gCEDTRKU1LwqNV1/j2FX0KnF/fhctDHPsDCns2J/K1BBt6Lcp/pJAR5bSc6RMB+nu8j8vQTqyZ80hYqH/FG/gBc0T8fWuwriVqNuzAcW0NSTLeWt6LiKUkHT1MLFYOW+3AD1ydt3Bm6M0Pf/QMgVktSRwM453KfmCLK8ZFOizSr8tfmHb7ko1copHMZbvL7HKqndp0fllejuw+1A0z6PufIc5bCWQ2wBTxwa2fImZUvXAVzXGUioI6dUpZRVXZx9qbaAsXIU8ayOWFY1kAn/sCPpnSPIX1bKNRZ6ngxZPrZIvVCZ2bilVZz1tnCYGrkvsQ0RZt+01FyVwRa+nI/6sORRdLoutxoEqQrN3gN3I9N+yYoQGLysfGf+ZVLjn3ayjdJCIBjug9zl1DbASjL5oZJIFobZUOcETB9/Y9nd9jgmMMuyDNwn+2b/kWhmDJV0DhELdUNUBuQadVG9wcvXPMXk2LHi/c20ncZ8/+EGJVOrFL1ahOlD2JbpCZTc7vPEkcegOdv3VdsSAzaKJndDMryiuRioAnSEFvPntxf/ROja77OavVDXAhn9L5riHBGDkcMtpwt+mcc1wIJQsQTkpYs2IJ7y0Ejbzqv7RJjh6xliTOvaZPbqidChQ06emVFuIgnuRCltQuh5ojd8Qa0i2xFxF3b4bVlL18t/2oBU1XLBReLl81R7yzbXAHllffOEcO5fMIGG3QB+187XBL3ncHsSivsxPuZjJVEceah7n4VXj6vR6oNhTfqAYK58/7eeteeL4mT3eJJUyknqiPcSMtXsbuEvqXTAxzVwCVKIsOCxa5m1n0rkjpKj9jv6xtGwIeScEg+2xA4POMJuqqe+cxuF9+VC0Y/soguIBnyuF1jZ3ApaG5X6SnleG9XeI+oPkxoqc5i7dIQA0J3493v1htlXq5ZMg4AWQOya4xrB/Am0jBd5WTJiTciLyQ6O6oLT8ciy2ykKESQXIiXr3EEQebNoimVcMYsuZdlIu81SoCwMN1t2IlVo0iSeSd36ki8pnwKiZbiLXGEp+PTrl/gFOQs7hf2xUS8/nO4gmc1zFvbz8AaSc0IEw4xmQNg+MrhE0kf6wDAfUupclcxYdPDFW1/mqepD12VWJ/x5mUV0l2bAHKEP/im5yY2DIdFQebrjTiXspyDv9Hl5izBp4TXd1vt9zGMjlAkNrCirmA8ZIhixMj0zzpFfD0FGw3c/414fqB9usrfMCBbmICuuErHNWiNRixe94MhhW8O27PJDbc1cUSXXBK3vwrwuV6Mpq2i1AHmOOS9R5M6lET0cF4b6sFSVUnZW/o34nqJEpQqSmKphHD6qkPpxCwVIyJ2AESkfEX5WT+5NcPelRUqMHWKC5Au7JpDdVq6yjXOAB+oTsMcMYMcFEQeuo79Dy5veZfHgg5K8SXrxLdaTQ6cHOcNwR6o/E36l8j3Te4b1qhNTuY/EzEuCXNHrnRkRuaqhe9/xhpCyyWUrscZX5OGqvCw3Raay/xQu0qNcm5l7wHa3QJAFgp/2Fh9VY1xNnHHfBOzD6J9R9wi/zVV36S3GYC1hxu1l6sAbG6HzOmGx9eR+YMlnhNDjY3EaJLBGAJvmuLdOBdQmuBxTgCE8rKwoW66FooRJgOPmP5tCcv1JxD/36eGqN/oisz4IEcsTY7trcowr2rUGXiH2lOgrVlLlFXZN+xmsLlLx7dTqpI3JMyYARPb5ixSfL2r6qZRdstYZJgCJGJIARh1/v++U68yjX9pTLr4+tl2zfQL02hZATPzn5O+/2iFTRGHKXh8V89Qrsb6FvmxmwNaTcWNMI7ie8J+q6A21nRnMp6SkVWiNSCev32XAVZGkn+irdqUIvL2YbSSriqEqk64ya7FQr6HDe63eOYdeoTaXAyKDDxquLBGxaw1JOLkIO6exONDEGLo7+W0iB7QJ4FRQT0wDVlYINJu9CQnHIvl7bw5iOQEYoxJ5XvCegoimjVK8nXvN2uw/gwCx0D9gQdSsFA/tY/kIOeMA1t2Q+/YbNGZIvHOC6UQbJE8BQEwatQzGqm61Vazocra6Ls5my8QyQ3hNH2guCZGQrXjbKNDCbmiVrCUb3u7qB86u6rUrDsdAYcGMzEsXMqWw6ZOTWwhNsLWvblRDq1xhQ0MKu/MjRX2UayasFiofyic96VkFlnDHNoA4ALwHqovXeBhYVXD4XvmCxwyEIQARhdxMb1WGJM/KLTtx7JazeRnPZ2vZ2piXsByhu17MqOPg1MYewz4S++jgEXvf4O6Uopt8qvEZ45tWamkvd365t59Zi5DS7dm2gEURJCul6lsQnb3fgd78gdVs4dTBif8ZncW+/+QKiQS2BtvrqubAxDYj/NiXqM15VQ2314qAtbhdJX4bBvDF2rFs4u03DwDTNvkMNFAzO+C44C9t21k7NF+r8GN807AVjA944tAlkYdcOC/zO7jFDUuM7cU8CsumbujokeH3SZjzR2Ej3iIZks3ipjxPi4IbkIE3DitidCZFZdkyixcvyeI/Vm+nTZEF9SlOmCd1BUvjr5UqhfviHgcp3vNLILr14YEV8W8L/bRuQ1/YzWNa0Q+pzXNJ06aQPxGh5ZY/AGB67dwVFSLYYgt4nk1thvmQzradGmuwlB0z1EuU/t0wB9BKokCmd9GFEPp4PzcFfrGKfGAuljkpITc2zVxWADeJfsocTsmnzrbbr3HSVWJmSobgLKaiOOUn5q6n4YhBxaGiTWQv0LEd3GK3lpguOpJJusV/aGATiE7EqZPb9wuYV6pxMEOIbCtM9s3fsBDWLnr5iSsEqd/jmWr3g+sEQz/mqa/V5b8ZNYjmVQqzAc9t32D7SA7ntbdoXxgHQTMOuRRr1Y5EYrVocMliG/sMiq+fCtZZZNRoQOwhoPqGNc3mSUpvHRRs+3KHssieaW5tygLLxnSpUqB9HwNLlLAT6xvBswd98RJVIxvBPkmeFaSsE/+GsqGyUP/FYvKEJENkbYBlEAd/Bi8XbwAVSALdMtkLEKQuCTwJNNFGhy3bm7Q0QO9KYrH+M92IrEcau0hAYmLk7COKEdy8YVe/+yHTvTThGgcYdFnPGypfXc18fWELigJStYCriL7kXEJsOiu40zpk7dn8a/MqBI5CQRVDZCESy4pYiGre2Hj4XZdx1zcIGVVqWmZK1OxOjZUQ7hdees/fK+jPmzVBmOHNHFcDi28m0tqz7g956AIjp73rMLiMMBa7ckZoTSeK+4BNkh556OBC1TZNGTUyvlVSjWv9wgBQATt5WxT5whgwr07IuUMg1ISNVRScXfS0NPYcJqTQPuFBsW/EhV4rDbxvrH9pzn/Pr+Mpjrm4BR+RaW2OAKs1sO7PIWO6/G1Hd43RmB1b+6IE8UJ2AQxLPVYvt0KHZzCPQWb4gewry8L5aOk7bHLeh19sVNhmb/EuhZqzeXIun551Srk+SpfVdi/KQquE9lQiDVPSKHoEzD8unqlia8rB2YB2q6jBL/GNB/PP3Fm2mp5JgC1Jh1ra+qrrhZU7fAF5rCipSUkqQyhRaap7N8hCbgYdF5J819Ec7YKhEcTTVGwoxtdQ4agAmNxvgwysne+cbo3xO+9m2ISG0r4cYfhwDQksiaJT33l399SM9F3Oin4ldHL7NAfTHkbpDB8qlfJM2NaQ3rol/Rtj3E1kC86oj6ozZ3x2xQvivlvuU+MV8VUcGtoJ+pxiGSHsad4LNbXwV5FBNsna8/CU9SZLrnmhP4WoHpceWwiekV36I2QjAS7bgY3eoCsBFsdkvWNInzLXJDYTTyf/FZm3L3na4qMFR13F2qd/KIwxTgsbJm5kpc5FT0os2IJe2blIGNfas7IRgZHeyEYCoVUPbZDuLCr8vEJY8CbyrbRw4YybI2wD3xsEkwHGSLMWp5AEketxvosHCmBQcpuDcX+7agHPpyBXs78c4ULDlBdR7pZO+0CoHMOe9TOV0OeCZvyoduRnFxXnZEKqqYPOMt+wrs6Zo2FaMlG+U210Hh8Q5NWWN/WHc6hDJdpfVHfPd6xCua9CNoQNYFdekodFfp2W241jinigUnSXZqZaakY5vphMx7ZMagR6j7VIADkS2ItIBKzljZAfdF8m5W/jF7VVC+dqVIzw8t32ZEolUv2oxZyQzCsnUwEYxVnL5yJFjvV0LTxRo35G25WsuNmRutMn4FFFP2UfNUjHUJkeB5q9BQeJHxCK0MaV1OXkL5mo48IFERQ4DlgRppXelVhJ5grHzaX90E7rPJzfps6s8YlVLFEfkOSkU/d0cm+k4aX3mNttrxKBMXKqpIhav723uEcg3NQ/yJcpbZ8Wt4U+rcJMMDFM7wT31W8vc4r5bCvacV7nlzdInnUHbKkqnlseiWNEpDOxpCqOXxwnqyKekoeSC2/RMla/I8DlWMKD68rSj/Ac2i6IiadefruY85AqsysHER8Qb7FJKmH1ajujUYuZ/vqPp6/7NiKUXCed7Is85/XLO3vuChELEkhQwrfU5/ejlWW/2cZRHtxxvpeVVSq8LiNvusaFBwfWSYEFZuITegh7sk1HBKxek1r49d4MfgYoygZypfEtpoQa7zX3Ip5S+sU5s9Vp+Q4PX5Ml9bjsUcWMYNb4ZzSZFkVpw+T9cDVwO0MFfy7WKcZjsfegeIQAjwc2E75BZFEbeyyTS8zWuQ+psVDcy1jLTmV+PobjZbFd89eEUxnPHK9/H9PrTOQiS7M1dWM94ABq4gAFvZHuyHny5BGPJCT0t1FuxI9+acISmrzUFDkKcrVxKf4uiZQSqfjmm1NgghqQjVgsWkc4WGJiK/XHTihCp+o023Zfn+YTZuQP05A0Yl0K0uddTBuNiSv9HHtIhK0ZLt93HWWlMG9XDnm2L/c0alATQExlU+6+7s+ADdDmRW7i+Rujv+ixR26cvnPm8P4JO3f3PifuDy5t/IVbSmGuG77yZp2O0+NHMCUI3MZunM0t6zlqs5Mx4izt65gkvs6LHZ7HIsX0Ikjn1N0asiXvfZ5RD9JQc5wuy6IPq8tn0PcDVusOwJIAOS5gfafaxkDMF2MA5MbvdHTT1Y5PVa2FNxcZBb+xyW2PqjHz4WrEbStorvz1417xqY6w5byhkZOk/hBiP4Z/ZQ9T/iHnvB91s/3FR39P9l1mPX7GDeKpIZLpDvx0zxZaGfpZynL1Ie5Wld3RhT2E3u5wVAlm3o2f4X8UlXWU23xfSO+mCC4nJ9ceqWLbCEKxg7Dr/1BRbOdxsLscsT7eiyl9Sh1a6Rv5GdgFyu3HsGi27Xg/UcprUstOYtjAq1VS1gkiXCoTZsU3aYzvBPtGcCe43a2aqf26nzFTgZs7hUGZS/Y9S4NlbLz/dCn/U5IodozjFfy0QTPpsKo0b+ArenSEEPt7SsZYboDGN/3h2ostNqX/51Rml56Xtmoj5ykeWK3RmHr/N/3tsC2rSif4QPh3V8dUhtP0tgdujWRhPvGinHVTTnAsq8PNXTI0FdO/MeIXyWeKKTnNvafFsT1xTGmcdJvpaeW1dHazShaQQz+0k+6t+N9TsIO4ZYVaVgayR2rBbeYYY9U9y6OZbeBk2+dlyPjwg4r5GqGWnzfMrjnI70WqLSFTTbgj4om5ybSs7RCwBQGP03o8JDiwY7HIaNLlHB1Avht36S0uzM7ievMWu9RMXywNb/2566ebu2eoBgCaRxNEFPr9h1tjO/lrTCQpA/Zfv+DpJO9qOaetYYn/OufHSGsKrHzdVTUSy5/+jF8AWcU4FOSK/MhJTRo2fvnGMsHdFG9Cs9z0+jVTcjABtB4W8sKaTZHpBsTanOPPSzFrHvfuHHsINCKj0d5TmHbcuWZ3Kw/jXkN5mR/hr/HxjcEkCgTqBzsqLqqawYDwkNIY5jc13miRO2xCk9PIJcv9a1QXMLriQcL/iguVt/oGmtXFze6sbM8jxijxOAI1CS3NhlL/NPXJtpRUY3ZIe/xFOin7ApFeTn3mI9VUNMXd39oYfOfmqQ2anvDKBnXJqGOktGBW3SOCmii1P+kYJ/IWxlcmOGW5xiads4qSO3ifcun19P95WBowt4YbjuInLB5fttuyOCfHHVNn9hAzH1t28nOfbykO5ZmXAUXl+K4eO4nS63KiWbmPA4sQNbk8+m7gg4xVLoxt+c0uI9achZ9Lf9fcs1KleNh/X/rKgMZCtYGcoBsuOFSq8wezqO7eLTt6g1++qhJx+a8CLbgUNXtqz0ood7I9JOmWC5ClbEjXtZQa1rTqJOUoWklGDl60/r295BU5vfK/a9wuxymIFdNfwbDVzqOYX4M0ZuRX/GEAcbgLUikGnRXFoUCoqEyJ9DJYyNYdRGpXS49XdLorDEJ89h6LcitmuNZRlz9vVWAuckRYjPxsw2ZE03rYmWzasKRSvKJHpSNZsXTlc5/VZ6QCw/KJwRrfGXhQIlTymaqRTIeGuvI+WR89OPyS+16H9MC5Joqul5QScLXyokf3YPb/P2QBzeD50GXC1TfDy0gJvl8k+M5Ifi/opGYwGUvjT4xhvMHh54KhV+jlBQ8pKvdDzr2VZqMSmeOPTaZdyzx0bMVF8bRV476u1wuqW4McQmdg5Z5NOX9bI7qy80Q6c84WMTWy+ntK6nJTMpmE/EkSlaEirzRvansYrD9+sJnfz0DR3yLpRWQ4zp6h6hXY0+hwxF3WwpEhHE6oIPJy+iXM3fi5WciDtnDJTKqzsG28hoN8KaeLiDEo3L7Zfy88zicy1mWdYOOvo0bapIESSTtcwRE+WfJYDja6rL3rML1Pw/QbUW3E1XnPUKGnGwjABEsLMhkEvDCdE7z9RXAENJi6OgTPbZ0ZrlT7lhp/4GhjtkmSlf3M2iSERe1xNboRLvDt95WBeJS9C59xgqInHoP+RelG1CJ819UHR5Zd0w1QugsnAUVzh1pKHZmXyzxsBnkHE5gHnsmbyX2TSsqB9LoSQ39qxVLu1whTVwlLQgi9g1acQOh5g+nZoVGnGdB+QhE+rvHLoYirTLQOEbfEvEY9ijLwasSCYtJtvlQZSTH0//CZ/C3DCBErwhgFwtGGng0p15Nq8OPqYAIgUeJ6vE8yP67AOUl1qNVs26eCjWTVt/4pDa6NgpDHrinJY/8uzwKfQnJeXblg6xWVkoL4dXH5H5h9GbNbQRov+B4Af7KQvnhQxrV7qYw9081lvkJVg+RZAJViiJtMnaSc7sQ6THj5FO/MTn2JeC9v/opstQyCzmR/FrietmdsewjwtAmJQ3/feXMIil3xACzQ8WG1kAYxyqmhxrSqPYdP5cpkKXy7MwhOz96qKp8SyfY7O+BxiuHV1gKVzJb60crhI0VOiTiuRCznKZuH79KKa0eC2DP/IF7f5bCb//wZqawk6WMkcO0TsV9X5Xokeoosep2KziXrLNVJk6gsjMFG6rbP64c4bGiNvOor5RwCjR48E9Z635bAx+MOqnffbCiO4m7V/uEXTWqNWyFY3uAFv5h/PhtgVGx5B+mw/hVG+9WJkHBhqejVkdJdA0lTbX6wNA+L4TvTFOGq7nuTiP4Yb1xFFL0uqOV/Ze6He6dqWys/9jCm+Cu4Oc5Z0kcRCYA50OTeeBysevS+picfDiyfdRKwguC35Dj/pMvyC4Sl4GpI3cpkZcRoonDSpI32Pe2H3HNu8tG3iNWM+rex0Id2uZyDuVXcuihixLBc5/Z6KcH+crBI0I61CUrCv/GOtI9wBkBvVJNm/qjfMEALrLxew28eB9D9UOdYjtnPqXMPG7IolwI5jm4p4Uu+TmQ47iFndER0+f1+IoiQmfnZ7AH8CznVB+w0baC6vQyjmJc3XRZ3anZ53oeSUoNWZTCk2g5zXRmt8B3V6uKIi/kx1sai50V0w1N7SRJ9zKuRGzY0AdxmJbIJYQhEHqM+1dgK2CQ2vyUG2UrzAlZxy/G/v+SJOWkt7n8JpxUonvsq6FgZdDk1619OVjAM5CF30PDobAW/mxW10ltUsHuvxsIhHkDIOQFSncFuA74n0DhkjV9DwXcN/B6vO8+4YB4XSem+HsUA9uf9xQ5GreaQmVdSGXDVmq1dQfEv21jjl2fwyc8hWcNYbiSFuyOQfvm88N9HqQdgB0NDX1bPgj5HzhtCV1lleAEtuonU56gDWU/0rPTcf2V55b9nxENjdt+9lbp3OF+9ItgMcqMO7R6JZS2Ly/HTNl+wu2TttopWwFAkTtmqZ0hDYyD5NSyRws+faMZSKbQjN0biHy1I/8E9usfkwloN5Domhy6mHaSqozdNWbDYQ51Wg5j47tNOeBhdOFk6acNQNmZ8Jny3wr2wcymtrs4pViKIHTD34z/A7SI4yqwDFQUQwhZsSvPqEZpVC+aLLVsJ3FHV2MgDeyWuOUjmJLDh4SXhqs6a5nMqGyakCdJLZEAuKytbkuDRzaIS7aqRJAY5DBAq9c+NHoLRGSy48RLCOttnHHttJQL7a9kHVx3/u4pCQ3M0Nx6CdOuqxkvLv5TJEBVMiYQWeaG4NK4kv+gcs6MR6lBrtwKaC/IvuicL0jfSihUFz7AOzNhQciTlfR6nSP600+0w4uBCFQTyOxkfpfKgcSK/zm3sHAFBpZOrJfrbKLqXp5SfCLE1fYVQ0XUARJJGb4Wf02DeFzJbvyqJPUtjOGNIZXsiGjr+GA3aTRx6KLNuZoK3LzrrhpzeQt7QuDkpFRbNHuoKQ5nT9qfjERTWrI5M9VVvPcE/IyLrXgCjgZfZRDbUR+jp8x9OmEpd/EDhesdWrOj+HghGbkhKVR5B+nd+fkA2LgDxR9UipipCWXZJRw6r4UpMk81ty+zexdJLINRlxPrJqA0sU22e06yLIWTxFYt+XwKIPpQ08Z/nCUGtl0tIeZQ5rUmxX5rHB1eK5rxP3paBajYKG5B1O/j7wto3yk0RPxWS6owGQJsjkmrnCyfqBjfYgworMKnipkcucgSSNtDmdUrHL/Bo2/ngH5XB8ITOoWD91mQjMeOPicvqCEEFP8qkiEgdjAG8kFjr/aVKc7CVHHI5WESvrskhzIAGUJ5LCIauPhaAXnaAVH70ejuJrtkqdTELhpSA9coOekIOr75CwoGZi/xNbc/WOmsVyksG3sYjwsOPxlDIetzHVLo2tWqFTM+kLAOv3n9exyeaKiEBOUZptXioFoIS9GReYJIRHjmhQDFAVmaeEx/gMIr63X+VEVDYRL7hEY75HYCC77Wqu6agwdDaTigJQagTBQHrQFZHJ2pgh/baech12qbDVMMh+RQB/A6h3ljwUMGRJdeFbw7DZ2SNscLj2HGjXzpRB35Y+9akHxMgwaGFk3bEan4tiTfCi9uZhdYo7m3Jzrqcy+7e74IydgYzkeUo0V5O6Y5TiG/TyLyvQen+IIrU/hWufRnwtJoMnoGGZ0p3z6Z3GCpEPnUV7DXugyHah3oDqFphYN07KvDvTl3EPObGcuGgRBs1Y+PjL16cUG4/y40NiG13bkvNaN70Q9F6eQI3AcuQnEbNJmsuaYOHZQbqJmJq5Go2SWBxaOoQmNlLGYRtNEd7m/7HxMO3l7MnN9IOfett80IuFgq4jBdh9P0wP7V3yoms1HiH31DlaoU8NsGC3UOb2/w2Zc7MgsA31uBWOR6eNWGnKZ25LYfJrzH2n0c3jft4wE0ffgc+bpoetN0//au9NlKTP4fWYty4/DJKtPHPnUmVD1Kq/HDHNCHBCkG0z59jTIPCHqu0o5j+HIhe985ZaDQ0kPIB7Wy5lqXyys1TugTkZStXVdGtvTGd681+rvCuGrkpuZEwSjA8D4nObYX9brhd5mpsyU0EBO8NY5I5KSlv4tJY9ORmF/StgvUyOgYMp/nfu3AfBumLqY2yYMBC1HYAw6xh/guzF3YwgZM8NrS/MFHwxL7IWsPrRN8RDCwADntNbhCuK1vI0kjBQdKzr9ZaDUrs36uWAjqrxw4b7moqcr4lxyxs+/8oZeOzuDErZNbIx5LEvbBOzpZIIvuj0SKa9IqEdRlZgn3tfwMxSoWAGbzPHcGrU6Kmx0VzaANvXxVYYZcnJxwVRnIJivUFS/5nE9r/kAsevVG9423QtCNXfHONkRES747O/U0E3dh3lqIdPaP1C0khrJJOdy18lSh8VWcOkSH1pj653arB9lijLEm1qjJIhfY6EiwiyEb0kDuzQdjHcP7VF35v/UtcU34wzhD9e0NfG6PVEZR7Lq1NNVy9LHD7tf/jXa6xi4kknO7Ka1yhUpiNwRXJeW5gLwUoALoRaIn9coWksBarnRpb9sbUMRY/tukq63WxUR0ebdoyM1IfKqXPQlrrj7h/lMLaCk/lIiD6jEfBmWd+u0MItvlUQF6dhPeClO1sCJCyLCs74m0uUjDKRBc8O+jEi+ofg6zzbMvTrk05s98t2/5slQAhH/bhE8PSQ+65Khq0hwK0qHbYA5/G7BoZDsa+hayvigXszwKfEnbTLlhcf74MOZTqZD6syO2soEU2Ac6Ov4f2dY30HeFWH79VxyPkaPzMvOs1TsZlc2BusQycLvm90Rtu4VcML5Rmw7FfThm/xnpQiF6A0lrqxQFeiMe6GK2qacBzXQRFHtuJbiJKbiuBuwp9afkU3MK2X1VRNA23OQpcBEio3l33bWQAGjOfuOu/KrwdFkUIOUiPNOlyVD5sB+lXLmqGMDw/OumbN6I6K67rPud8738YH8DXNYtCphlvKDjiWCd/p4Ln0QpYKW3XOA/J/uZAJvcZNQSRWcBjHE7Rg8Qs06dCnI2D6lRl9lkg0Pv4lxJFuUUHkf0I3Qj1yF2cS7JR3nyyaa9Xae/98pnYC9l9iZZZmQnZWQw3slygPrTCwhWHXRQWv6MY8IHN9J97m1upQ/WYSa0W8XpvV3AgYniufgby3F5aZUTM2S5GjMp/kVZ+dacELZBAdp0BMTqb0zeRx5ET+mrTUFDINgl67J7TPVjmpbMvkP7vef0DvD3EQlV0fPZuKKw0Qa/UMtrQ1eW3b5BWdC6fSzi489pcJRkHKw+/uIr2OnGwT+p2tafLvobWXYveorvfHyrZVvfeh2M1ZlLaQHSoQBNrcdsD00ruAH8JzQhmaHlHlSOw7ae5ntSiirwgDmSbjevQAWKsU9H+IJ7iiwLZDOqIOHbiY/mwuqtrron6EPayDX7Th5jQR7omuCdN20mnvgXHObEd4/53JfuSl8aytVi+240NPJkHMsqVCdH+1wHt4dj1yAkwi/cUMZZt17KFtB+YZuaEoU2EUL6BBXowXeYRy1VOs1feacrjZjEWMagVQRnOuZ/9p3GY/pvE+vtFDwEHsLVMeV5HeIeTNvEZJzOLGaSZtzYRbGNC0BQYHipOoMXXX/2tvcJMqjR674XLQJGZPhoJbWdksHT3jUlbrvPkzpoFWPv5IYkuWA7+WijBb+pFetg2ByvF5rTandT9NiMATq5zyplAilOqcK9DibxIcMhtiT54QWspTCwzUPPBTAFiJVH7isok9du6vAk4FwvmJk4b9CgpXAlBGcJ/KJQTLX8yfE78T5ln78uZshQOkJNU8dUEWvHORR3AEmQHZCjD/AvhsADc/9URLlgAK/NgdHQXPbwTU46GYFqLnGLLAsbnJd+PJWLpFw+MtREDHQwev7csxa8mjKr6ALpW8HaP47auZSm7KGnpnV6Fe6M8LfDobHG0hoZqybp+QTgTWRn7SdiJ2zSWeDZUr+/TjU5b2TwskpHWhZqMPDIFdS5L1h7SQA0f5lKK7yv7WyNJO+eTobsBVF4b0Uk9f0deCii+7t10+lhV3IHCyPf4QQfkkRYTJxEhl6BjSZUJoTHiuOQzSJF2rPQsh/5z//zJL68O/OW/6y7PhNvrIaysUZCvGEeaY5nVe/eGCf7tnp6ASnMwB462wTy+Z4GdNO42PwCdT+IO8g1IFAfc0PZflIN0F9eyh483aEns+nXX0dTuqUaN/cP2E7ENATHCJ7L80zGTQUR2sxbEuJkGQxVnlUwEQoH5YBdxSG5mUTEpQyGtvx8IWisBGjAg7tUbtKEKQluFu170ArafTp5tgMfj7WzcNa23luczYEsUDGRutH3ulOsvWA7+VBwD5qKxTRu0tysuvx/rOak6MffGMa7VerM634Dt47cvqWhiFCnDkRVNPsOegAotEE4e1398EebyJvCUcWJhb56Y17aKOmDxR3FJo3M1J5OEqZzBPlWYjQwSi9i5BrUnrVsTMXIE/ADXWVbI63uvsk/VYnp3GoYJ6YjpvPPGsdq01ZYQXc2Vs13bU4jFcj9JaM8NpzrV8ajDJyjsn4ogbV8lLj3V/xOhsDuz+NbHqV+G7u8WxbDPoudq2KQS1C2531E6wjHCgZodm2DbRAJD4yMDteDBIxuLqXgLa4XSM3Jm4QM3QKp0AIsDrhOaEIwWu61JKWhtzjH68MtJdDTM/Qv/4yDla4BXMeFHF2hqcWA/f1elHhwGNBsVL8EFQh0RDmiSknlCaC9CF0kcr53D48Ohb0EsENFxpaFRh3kEjfZ203VctEs4o//q6EkZpYOArAGLdCVK2LzFnB5S0a8pQwxPW8leynphrHTQu2ntyIOnjpORC01Qv03SNwZs8Zc0b91Xpxx6ENGM2mW+tU1ysZUxI+7cJdEfjOfpq0UuBCVvHQWVnlgWB6reyPzHOVbmTi5vSRWRD6LUHuIF5KpCsBDgFSilELXgvHDXhUZlhFKjZdp9l1vBLMz28WYSUS7Tf7bri9D8oUntBULLfmXyOhvQZW7X4sKkinp3UuDfHWDXr+HNzIYZu9+9glCWHiQFSO1+RGaGWwyJTKBMneIbXMixpnPEy3K4T2O0f9kXv91jOuHSEDEtetFTNXWa5dKMXcnYA4b6VCvFaD5miIADG/0n4kiagYx0yf5Ohg7LYYamSRpHcRyOu+SvK4nBetB+Ubkql0/3jHMhpWPoDJXidrEu1/6yGx9iKIrurDp/Mof6t0qxOs3Bnze86NMUtPlmcFgU8fS1IXieUKPLtzqzvZ0N9vjE75szh4kM/cbdvGfdLgnFqAFFrTQvAZJGzq2542NmiAR8jXBWZx0BEghPTDn1WDyPAaUrTdXJcdEy6dw7fDG9TGL5i7thlrVXc1LyPiDBGnzhFdCjWEpVr/jVH+NGMk6OtnvaiscVApSd/t9fpXkF8OdcDOfIuebpV5vMgbtvUiaTTN+5cWRxiXdwb7V5BI8AsUz1tIZ3smoO2NK8ZeE1SE0Yk9xdto01ngmdI2qKJuMqqONnKomEq9yUdDcJpF/KedNeV7FJrVostv80dA0GmP6nGapP6sXwYI4efrokeQTGojFEQJ4F7DX96l9ngkEysb7UQFcYb2nMoux38obYKYLWrotTT25iAkhAmh0M6RU6X2BxfcbyNDNJYw31lhFoAOQvOF1vNNqz6tBCdeuVyZHwfR2yeRNyhZaptGYoRNoLbUPiQEfu2MxOvztFw/eAqCxrzLhM9fNguAprE0nYx3H/oHAVJAOAb55lSkuINksqb8qpOB4EgMxxryy6bKZLQgnKaqplcdDeoWC23WBk9wwuI5Y5kMNmdAssCcOhIBEWMoAdR6/2wBMAYpJcdJh4X1C4gUhHjjIjPCIRDKXE79KI20TDdRTdWUPElg3aMMX7YiMZWu+WYDJkhHpY8PBJoSIsiH7e7oQgbQw4QBjH3ML1Ub/M05nE5AOa+Yl8e+2K/L6f4jn5mthH/MpGoyIoDzBB/ePBlfVl8A0oqfMxA+bM4qWx7tGARSbA4oPhTDgiqTf7TP2uL0JRU0wJvci9RkVTpWkz5LEOcAB4KnOB2kFK/4DjVvVVzl2gvjGnem1gndlZrWygdNkFfJ7mUBidyvL/+48BMPaEycuJmvsbDDL9f6WgulgU268fQvaVFNFV5L+VeEtfEB50yKrqlaUtbbNyLKve42IFlDyDwHD7MDACBFcHFG12MNn93oR9JztWjlhLHk+LNX47Ch4eC8C5myzZrfA7A/sdoCrLSwZ9zMzNkzmwVoVs1+1GaG1GaNsXqCT/cQl7mRf76/d81vRVMn/ILZAEJoWpo4z2Ynh54NoYQvfpNOmRICvizG3XgsYOxpxTp8iD7FS5yiaxyU9rI0HXm1tli6Bm83TajWbtiGEordGIoYzmHwym23z78KcRyalzNMCXflBoXFWDICIzcEblLLI33gc/HCbla4v4LY4Yp/F2EupIRh75IQiHEnSvqusVJDiLsQVDjibalo4OTggY12Xvx/NGjMRGdWNsyj30N5cH0Fv+AnoH2fJasJoaCjlZakY/AEZAbpsVNEZA6+n1fUbUJ6PyMArild5zIrr0mKif3cboFrvvdSrkRTe/vRBzVmMsV70SjDLWPmyozYEpKKp9vdW8Y+SjNyzXKkY49Re21QVSamS+NcWSDJr3uMiWA0Zg22qUEF75sKkVh/qlD8bOogM33ofprfHeVk9d/2nKlrOyNC2piGCwtgj2uyG75wCJp5TopelNu9u9rpe6mWG3wy9DyIzo5Al9NF0OdXZVh87/9DKJtYQr/w3urMrtDWHP6FmDYGjz0ae4uOjHNRNkFQw4YlL7/mzw2KTfT9MoNl1IibTjKh3fe/TXgQIRpi6Uf1SllZ0JJy2+5xIAxRTlbJk0DNWRTryuznRti8zsaZrMYb0nz2V4GJ1oLJztZzABOCE7JcVVcmHyHDz4wam1mmVn5ispgHl9bxHZF9qCJ6S2RTCPuIsyfIomE3qbCQdeiaPOE0LHRi0NPOhjhSHV+u6zlPq0cJ2C9A3uJH+Y3x6g457FdA2i8bwyjioUIx2lAZmu8OGjilQLruopkc/BJNriQkZ7ECWcRLAr1t4GGWHIRpuRNFCiarYETOQectKwZW5UPhvwoLWdNV6q4Su1VJUYgzqkyEp/tRHPQzMKjQMYaHMlISyhttcSTTAcO+NLfYzjvm9LGzJSuMd/e7Sks+Bxwb2NDGjwkVJQtoIFQzS9Ibj+200W5C8KSRZcBk8c/HTk4u4Y3L/wUK6CjyQoe0eqrS60/Pvn/dzwk63iZ02IQMOclrxgDn3oJDYEId9yMFcwo2AZix1VxzdJ+FjW8n61vsoLitgA/MZ7/LbCNuvKXng4GU03TgX0uuyO3a7rP+k9Im9R6H9RR0TLVaqXg/9MiclX8LvLGVDfS5E1bV84zvxOfP9HmTeQvxI332aK+x+wB2S/IMUBhsMTLj2TUpP/uAu0vBnljOce/EWJGM3Z2r1XohcLLVHo9+ww0vB8dyCmyExT1c4meSC1Z3Dy85EX7aF1owKbRgl3bb6Xi8OyC5dq2OCDmJn7qpw3ZijwaiR11qK4i7zxvG7yVNQwlwdEr9rk3Mvpqj6ReOs1xOglVIXnAMUiifFXgVwG5jIHBiT0+7Odaq1BLiBsFwThXNKNZGjiJUM4AXxQaaJ8+SbcLNyGrYyfm7+NsezJOOSaKlFiYITkyVzTJfZh0jgpBykyyxO8/JdadHIXZ8aM5fQtcvR8gmaxoC38LuKhxxn0wUoj2eWzLdwuvLwt7eZsC86jHP172hk662AJGY+kXTue/4s9qJZPOqPX16pMe1K1nCArKrquUvTlh4JEixurEi/NkFGvjIS7C2jlPsBGAiEtG1IUpNu6CVjz/vKqGQRoxUGvt4ao4gZACwbqQmekJ1fUczd7+BFUUNtYe7BkONxOd3esvS+/+vtpgnEh5XHWY9/Z0fsF2+F7ZYxTqD2qeKoNE6v1/14x6HCy+ROl/hhEUnSITOLhs2rcT65pBPX+Yv8qKW69cw+vQdaN7BNhGe5uD3qT4yyeHysvhQ0s7EMv3Vx0gYhd0rKlzMHzt6uhh5uHzUnv5MoYRleyr4OjmaVlFad72YXmrTRGid1IVZX3Jc3ito0oLj+eYLOG2AssdnksjD/89GmMgnyqSyp/lWayxAQ1P+I3G3/RoXbh3oymjamZ45c/AGkOF9zzEOZMiSDLhJu6eHplhc0n8+2my1PgNiE8Pn1OdJ7SBpnQJMwfNYs/e8NjqoyV3qgea/7p0sVu2L0/ivVCWlUrGvcRg9t9chVJxuzs4wRPWHOmkh5TWLZpxiZCWbaNVDPK4kIAtMi1hbHBGf4nYar+nrWcIWLCDN0rwSDa5XBh9scAeUJtGBGTjMhLSmFqSo/Ecj1VCXD/US0IzDea+FmF9huPbgc28SsT46tzD4r3QNNcY7bcQN5Qoq7P2UH66iz5ZjC3pXrN4/9QxCaZXBF/Mw4kk/DShpG0MOdHZjINGs6lzgsRJ6wigCGWB10qT7FTQ6V30Ghm5KG8a6E1IBAESvk66yFU6Shgjb6fhUindc2e99peqA2v+Xrefz7vwQKF+fpCk9BN9sWZ7//i/1vv2ZskNIJy1vQfh6D/rN5IDtJ/XpGOb3+pBt6ngQxlJJxyafzrykTFEWLjrhZ3OG8tIRY9fogftxk0AlMWJLYVQNywMQY/PngDo1bau1ugDlJxTALVakMLeSSuY8vsRV1E+O7zg26rsg2W7ae0CL79fEBpNqp8lzEsIGXIYyRkcCLB4QL3GeEsrk9AxIunDXYoACTjSrMMKDdMZS6aCi6MHEluMwBIFvHIe7p/0sAHkWEibV6MJdMVrrCwWVoAFvASaoEKIAq5is0VTPQSIZ0CpptoqxN96LbyuhA5lV2GryLxptvoI6FFKsBojkKZPZ1Fs2Q1OoZmblPRuQhdkMEC3yz3yR27YGgCUC7AuVwRVYXa6S/OwQgVqzexi656ybV6ai7axC8Lp/sslZ/mPBDfTZR2M0EHq5AopKFsbCyTeGAymCPmk4dmZd8rVMAG0/Cbcx1WYrhIAb2bQbhYZl9t3BMDhyYQdemMmLKJU8NQYc5GyKfJBKhKZ5BA/iSUk3VR9l1j/GtmwEzl4aC+b0KNY1ppkbFzwtX+LXuck3vr0QhbAlTQsKgqns4Ipfs9mHW/61CD7l0zeNsN8vPWZeVaAOBITE9pgbrpHIMdetF6hrtu75GF2pKfgcnwurBwoyh2eKiQ+Ik0dQpYsy9ofiHKksPIln4/7ndRp5iwAwqZbneMT27DwlGCULBHgfkO8B6SypTahIrANIxhSG14qmkmDeuPJpg04BvhjWNTymqanTnNS2RLq/DYc6NHtsX4zAN4VYs/UfuNjkZzkH+It/GrfjRi/3sE9UdivhM+OJb307/yhadWkmhz9Bb0YTFWK8+yei0rWNmU1fOGAfmK3xgHWfORKdgAurTxYhfB4mqkAuNAtUIP52BqAbz05sDeGpknDBgaueuOyrPD2AKXFjOZA2DKTkJpY9XjLIF1/Y4KVhHrQThh3qrHHlVRzQfoG3z6QxzJqh654C0wnGfC/gz5lg/wMud31eH7DGQgWctgXhWhG8i6rJJloxTEMGXkQx7fqA3KRWJO2wLDpGOjl+sPG3rBwQ0ok9og3QPQi4XDJUtp4/cfAv1udo2AU87vQWGQ2L5BZ1s3/BiAd8cmxKdWSlCVQD36gZ4d0lJDKtdC+aMN+b0Nh+j9Lt4fXHXZpiqLuwbTB/kK4a+JXw1cQCI2hK5xxVaiC5Ypcne31CmMmlcEh43jDd7gUv4o9mg6X8BbkT0CoZqpm3ZXW+M044pl56nfVd5yU13IMyAfvOP5TIHe7PVjeAYicr1l7ew65rY9lYOIXz+TvAOpB35T1uoYUcUyCtgReYisOv7WytDhquTq/cev323eA+Zt+Hg+WIufOXPJXsVbI5Elpp6A0tYKS18+/ul1Pjh5om/U42SQHD+MFh1lE32kxvtypdZ9fwStfFqnkP721zEGDFDV0+gaLiC/sap+7642BSPqU7FVC5qnwr3EQzFxwqsFAAMKXUFVYCHc7OvMR5db2Fhmiuwe40QaeEzWbxyQU2Scn7ikU6NsuN1LR1OYnrzMD3Vl4lq5hpBu732XBfdyhoUUYQciE8jCrh6xqLtbLCiR1/Xp7cmAvzfkA9fM3VunMwUOZa7zZkH4UgokdW3GxwZaLhP/Zt2Rq+AnhM7J8lsCkx4Jo8VqSjtDdVTVu8BuUWdxt7I1bGU0JpRn05b0EyA7Qeq80m0SGalz2CiYFFFCmC0sMjmlC+2lSkLQ6oAE+tDrZGwShugZWY1+7t+S8b6MOYf0c2z6XNQpDEqe45Yc4cuozERGmMGo3JFweXuXReXKZVsqKD0QhC+UK2GwxoPcE7Ej/ZzlUG1NCoj3+hXyXxQvnccBetKG8h/BUvDLzj6jo3KMCnAngjDK0ACln4UHmSrOqHsk+W9T8Q2d5WeT+m0TODJSwuNhOtM89d+0i+27WxMwtTAaOsiMIx+swNnwUCXWulrt4Z3sgLVqsSr90Z6cfP5NhoGb9QcLVuTJQEdZcZCtSxv3+gFGC1QHP2pmAspokvRLCZiIU+QwnifT0nV8HTZ8bl5joXBTzNwQHUEAYBidX1kk++MqAVDUzSRF1avKIjusDLA8Y5qDi+tNXmCn4vwFsGoJenXjyZAmNGVznoku691CpoR7/Sz4V7Ed6NS7a2sx0AiV49j3+CnBChYAk8OB5T45CrFqy0faUp/c7YPhC5E+7HVkynL1kMfsGtkgCm/vkrzoD1L4TVm50EMB1ONM+MTjNeHX4LVQ/CTMwkUiieEL16p/j+6kDZz9eBtC125IGshZFHUPB+mhscXFrw+QB0V2jgRRlAc2hEBEMRC/7rCoMKKHinhjNOlAA3xI0M3jpmx19RFWw9gndtIOdghQ2Ci3D6vdzYxdFoBmMuNuEIa8sAkaoL33Vm2CDgp1/fZ0a8oht3dF0rS9sQoA1JgyD/f2jW9vBdRkdxUWywmUpxQF39PPm1F/PFbbwgvoIvm5u37JmMu02sFtW08lSAVn2EtliITH5lSE+DlRf3dBRnKIvQZ7vFkYF147Ee6rzpVwa0vRBbbItLjJx88bLxSQ4JpxRpmg8/yNPaEmbhB+z57b9mdZfEMqUnFN+Bz8Ktt3aMdPI9GsGE6ntVchvuhu+gTTJMxqVrTxcthmJTk5bt03r6JxfMOPWbimHmupgbtUQQTFBSaBBR4DBZcahh0Sey+qnU2Q9NlyhZz8z2QkrV+iaAXd0ulxW2NiOc4INucV4eq+oBeDAbH8ifwkVf0w5ZQaZs6knR/gAgiH+qa3IEuBRM4lPEds/5/vFqfu/Mlj5eBt1xCXDwD4lCq+mI9BTh14fPHwkZAZJnAKXmmt0qlK461jK3+eIPV8CVXCFlJT+2gMP6nvBg6GREieLfwVeaRgTmerUnoXRlb5snR6a09uCyLUy7k+weHQpw7C23toP5Zq+u32yB94cS2qBYuLBZ7ivUSSmFUOgQ6MH20lF1GkKyR+qvUWgs/HAwtPtXyHVDIUFQ066S2TI2zJzNRYqDot5wRKKCiZJe3pcwKaL9LomTDjQIYM1dISRN9cIZ9N+kM5X/8UenkqIYNaVvYC+aIXQ5Jr24+rnA4/lF28MLiNbDWhxT/qhhu9+Idh8oFSwFszOQzy60A6YMwj1vGQ2eJBVa0Hc7Cgi+3EX77cmz97bBfRQ6EVkHUR1mTpnCqjOCJg+HCHAtXQO9rplj3AopyY82uK/PPQ4fW4N/Vz45AeLqZNzAMhZYczNw5zERZBQ6yfdQGVLS/I+rNeMOlVkW4JUsXhbQT3PknMzuDGAlYLfkTEvpz17H+gqkQfGMlb1C/X0VkDV8iTA/F7nFY/M4vXoKt5G8yKYIC7cnbf7Db1pkCKM3fkXRHP70rhFEQ9G2JyVTVraKJ0zzWMuNVUG4IAX0ZXVqeHum2D8xiOZXqy5n1WF23I9rJFlZagH38vosY0Bfn32ZcTnx7Um2tpn20h0kLhHw+gOjDyVRLqEUOdpiJHXeOo/O08LRq56fOnTOdJ0zg3+4Mk3v3FycFpjGkmE3+iLIgL0cQ5G+buv+houkYfF5mu+iGPwRTzIN6K6gMWs6i3q5vCJxihtj26B22cLUWFzDoW/E+B+ozT6bSCKbF9t0KNlZN8xtzoUmriSuqpsDYsl/qH90RGVNQ5H642yP9KG+88Gr3iEPjsokskOaVcfHqPCAy4PZOpV9RYXUPnK2LYA6qVWstHpZNJ/3LLfnDfOMZo8g3QK1C2pVDnI+2T7uFNWdN0Akh6rmUbYJysG4xne6XSUGNWjYeVd8RQhJUnjvM/BIUmjc2/eJ2RahvLYK7TeHgPuF4rs/sJuXI3QXEUpJIeWFNdihA71b4I7UO5+qKjyMVl4eurQViseJQCcC3OIYqA8GWuzveTUQjqE2bXvC5H3OQzjWfmsPr6pKW4Q6AwAk3jLalwekHhwqhRfQSNZnqRBVtBAFF9aXRGfFCkP0/GrGIUsCA58LVw4e1sW5j/p3cfb2Vh3AUCP6PJsadA+Y61l+Je+I5ICo53/0Pnvm0EDkWSHq9o3CYqU12Yj6nYZKHin/IxBec0jrj/2JCrvHJV+Gk2Fhq24n5AfdMVZNFvdDK3E72QcpAsWXyNXxexox78c5QHMGkGGHH1FZPd6wQDeaeF6qbN/Y4GONVm2cuFpkP8urAg88RqJmd9ulh7Qhx5ZcwBM/9keoFAo/ZFDyanwpocd6lrg+sT4khMHdPkZSHfaeuSapWge12BsuydOc2J2D/pWuODO1SgWcdo8JX419/iZUjP5spteXzwdGC5QxRc72PHagfirvuWsPD0yJRXY+g8tRsr04n6/zBkq5QcS8E8uznfYA3Y9lVkN3fs3wkP6vuFdYmqAu0bafMENVbHaEhRS/QRzV7Itq9HvXyKQ/ki6QeqiS7FMGOqH9quLEaYmGMN1KOvU6oxu96ANiNIUFX8QJp/hzm9vTXxFj/gTqLyOaedATrjtHR4Lx1Wh+RDyJaicKmc6hz7IeWErAKBrrCfo9HlT57IITT8ZwwcrTlzfaZpP08Rt17PK/Vgq97uwEfbe6DS0YRq8pHPPFkX0Rfp0MsIJnDO1sHWWQrr8bhh6kW8kyAEzoprs/6yPwhlBDdHxYfnY0Ohxjv7vPHMukktRVOexY7UfQK9m8TeB7k+/MnquDgWjNRrfXuKKA0lYaVfgswIi3nYJvWeBjjRmIlReFBOcHQWNrM47CStrc3p3f6jZ5KdF+Ugtc/1Z7fz0v5a3q3pQMTzv9hlRuUX0lUiejIWg7G8BciZ66gMZg/hz1krrr6CU6M47iJ9K5UlurfUke25xQAY9SWw8c2sAS6Drt9U4T/alLsTKXxRJQOMHWEei/bM6PPPu6pyXjFDh+dc5nN7p2lur2IybZAldgO0CCp9rWeTdleqCs+0mgWBbFbHbCWkc3Kn0ZzW7LUBxYVh0HruWNO8SCbzNRCB9YvIp3OHlWbrbH4jhymFr5iDXsAXb+oW0MiQkHNvf4hUqr/AysvTXky+/jEvRs4b1O+thG0AgzCs6G9KY8MfgUjDM5826JUgk3D3KWjRzUgsxHQvSdi9TrECs9+XXKkz81fTSRd3xCH93H5NE8Ac41MVQwjETHvmJJadRp9hILgJ+NL5KXCzc6V4gwZ9DjpAb/j3XVnsnSY5g5lkGM5PDJaDV68paSsEeAramctqhPVTS6bsF7+AX6mvzxXb1zk4XkVgZTLtBl/l84r9nimr1/bURBdr2hYDfthpoHNd2p4UerqQpuWUm5NtPtAa91CzjZjB9Bjbm2Bj5gvZDZ+iKC7vsy0MQ6VE/A/bMAP456poKVlgwTG53q+3DGfeSgssZzQ/GJ0wN2wVldNdVQfu12yiFHMJ5pn5j+bmHUVbE8vmSwGVs3bI5/mOqsKnC8KvsPhkZZbkKzauL81722vMf7vvS0+4pPTr5u3TwdPu3bd5VfHFbHQVxTe2GA4jBljO5d61UW0idjiYAbtB5huhcVdBYAuM6BvcjCCAClixpnIg6XCNkCR9Ov5Zhkx+iqlpuEOUbuFuyUJaFRjP5Lbl1T9Fq2DZ7PzsKG9tH69mZ8RHTBtiFKzFWZ29BKJfU6QnvYE5zC9IuNrvlMOJ+cqlk3CU1RGWETQWvulZ7kO81O5Wks6gYZ8XY2hRzQ8NYjTmpSm/7cEBiyYYQ4q/I/ieWV1oUKX484z+mY6tIMziBKD9KwGSx4yd9D7JvYF/i7RhmpcSx5lQoNhlEjf6CkRnnQpIIk744edb/j2DYXIIcjzHMnsi5nEoKPt6EtF0WI9QxLMp3T0WOvT2zrozsP1C/zkXX7BqYmeygRmWHGvQ2KUKBm7ihoOliegAEXAiN4xUWABdmxJMduo/Ai38lacLvWaMlhAFFmyAZjkcyhiPSJ617eL3Oc5wrPQ5S+8hzSqXgnMaq21vARs9n4CN3Qx/nSUqSI79MmLUfDfHnfT1bYMhm5hilO5w4tnMWgPnB9F/5yyTUMBZmq2tEuKFxMk+LX103dOBw8QoUhPwXSF34O5M0P1Efv0IeY/PtGl6wtpcNKXhik1ZLyI92fg2QOZ995IzjGppRwbVpWXFt0IU+NwFoYDOHwf+fm5ChW1GjM8OCXJApwn4s43qp/1sfqZ08NH5iAoYq7r1ApY5VrCrs1fIDFQMYzBQMeomyXN8TO7vP/z+9Yn2WME43I+P8X1VrD884wA7ytLPxZt2jGpbngao8Lu/SUMeDwyneV3rdIdwzCXzCYep0w0Zgu9+kPMULejvf+6vtHwTukk2CkuS63VvjJxjI3WJJsYxPdpfPdE7GITEGT1oJpX6eMoSIcn7ohklyZIoXgqu+0cRb57nh9VelWV6txiIYnoBBdIaTBTdRIIfyVXEeE8uTcy9phw939iAX+flnnoBInjDgdE9aPbqt9emkgmFh2LP/PeaWhS4B6+/bzzMuYBi87wDEaJuYSddCTJP59feZWq6mh4NywZxWuelU4I2JsGSKMuLqQvFj7OMQ647d20N1jH1glBhHa0jN8cbyEbMsXRPycNl5EziWqVyT2MaVLiekwX6gO+PS8MgEOvZE0Kpdl++HZTfRvIzbhX876U/P43bXcyaHUWvz9NmM0J55J/9i60c7l+in3B/9/QMS+o3wOFnqu2pekKxnAKN7O94lontQd/mYVv67unnxkjnxglk1yUilzr9AzAlPDFdy5VMrSqbLSjkg68ZMR2kF7VNGc/xONxcB9x60NyUEYwpibK2ESNqAKaEJGQrGgmuOnR/Xd2WVoYSTdnnNCJJNCRRzKUiq/XRCNMnx4j6bjZKL/eaBO4FQJcYGHZ4NuK/AQbBZCK0rG/TfyUHMjcCKIzjyJzJZfQdmLyY0U35qvfvb/wjT2k5wUi0Cg2C8c6Msc+bCJ3jo+Hr3f01CV9I9ydUgxVglAe0LKPvYH30bW54NoDXuiq1/8B9b5J3nxoBkdM5vauyFsm7IUaOdrZ8t1clH0qR+ZzQSQABRRdU1j4PUlWS0tC6zLSpKpIrEjZmfSneEEv1Nv8xEMjQkQ+ZJc4UG/BxTJ51Dg1A556W0xsT1KUvOBPf9lQSkEEw9ZYRMHDI9zCrIBFnnuS9zoz1ey3DzVjucTaKj5Qkp3Y7WacdL9HDdlsrq91u6+OSyBkLHonzDCaDGA/mHGQV0XoLfxmHbSwB0PFtpWkvmchy06jzdPggLvSQt49LvTPwXfaZB+oaM8tj08ahIb+adsZe2pNXKC5YGfgehP22zTgUUQz8RKfvg+79AiFbeeYrMSUGqeqST6L6PEo6H4jydlOYUCvsU7MH/u6172Xp0ey5L8Ja6yu8qWsqiWyE3O00/J5T9ec7DFem1+Vw95RWmrQJ0O4mslXTHkv26ey3huY3cC5Ci0xX9Rubo+YXj3pJcB3V14AkbCgipzRH10tMSMEUq9cbqoPdkZuKwrLVEXAIwBudzsoOA5YNRrc5F5tufnMSPBNtgcq9Nnvr2331bDxBNXIGlB8OhrMsxwGSeFbp9b9m6mxr4e22efbtaFgm68n0UzdV3DrE0pvLS1dwN5XGjw95k5PU06TWWwl4zXdXdWbDhJ5WA8KP2V5MZC9NJB7G8UnQn5qVLK8Jd0Qqi4Ylmhxj4WgFvBHQxkeo09cZtWJGtwpgmAGxlJxgAF89uncULS8bQAki7y+vqtSU51Qmzm7pM19kpPmVRmvXG+wYEYG63bR1qRwlWrl8RiT0W1uIfSnRprDWHjx+PqMytR8x5/WdaOkzZSAL7Jvb7hdAgArxowKxMOc5KWG3ujj61CgQ82CNgz76wLamneyIQHZpm4n/uhBALvovIg0MExSK3Z9YD72QHqebw3VuQ5JqLf+UNul5shVNmBIsfuraoei+zaZ86O/al86EFjnzNT0kGTrvCATVhQmRpXWqnJdCCPStuv+1uFXoJWM/CIQAEEnwV19/8r9bIt6LRUyTvV5Fwy+gTdNlxHSrL3WvrET9BCRQUU8r48wRRRE6QMhZs3cAxLOMXA7hw3F6vRCkDwz45qUki0nlOHS0eAOWpaLAzdNenHEC9nBIyjGRW+H0RMusIZyiJyik76n0lgCgsMkKTw9ku9QVr+mukieJlflMSnhsA5FL9gb+JnuCUVPTmYZnUhDPFRIpKrxr2K1cwRgJISbP2htTEcWxKGKA8VsgC+jNWChist83jN/qLKvRn1mZgyK4jmvd6edXlrKxKA43DDd9zJFOopnO+nDqoNrxZ0cPrYw8pDh0AUEe/t7TLQKCRmWQu/pBsd71wyr8M8pCzmFlv5U9OgGj+WMHB6UGaa5jM5ugxt8H/ugTWUVVPEEkUiR1Kpa5psNFDmu5bKt8IheiVbcpQqQWyz+SR8cjkMAOOxTbYu5/BsadBW/g/TbIUEcJllFnwUHNQA0mX+YWeCsQRsIOmrFY3PCsddxeKF17upebDrh2Kd6qiMVoR7uQmGVXy4NdvM/EtrONtmYsCsseMKABHjmCXgko9xpDAZtvgiu0kCtgbukZoQSwZTLeHS/1C+u6dbMgz0KsDXmQ4kZz2653slgwa8o+CKiUqvxDEzV/rwWZUdmz1/WyDPM65mqaIJXR2XAJ/k34QFvd1Q4qhMVPa70sxzpWubOlyrmAC3MO+TXzW/q3At6Js8UBWJVPqA9SeY97I9AIJ3Th8S+chHfSX/XzP1rZhBcEJvfZZeHgmlcC+PalOsaayYMGcJTRvonpQ47u/YpYP+qS3TdxTNdqGBr+3Bmyk6v4JcdGhLV+YxJ6oY41EClme5il2Uo1VwxLh3AfPXwcv+TLRmAUcN8t5OhgClW6Lazq5Uw/j/Km0deY74PnmZKAyW22Pk53dJ4euXlqH5vqGj18qeSUe/Rogpn9lTELi3dkesaz97qFHCpgSnZavmTIDBX7SdfYOIuc37fWFsih1S4ehWiz/Ks9BYOu2rrj+PfA7p7fzYjNLH4q0IV3QvTeUFYe9wL/1HWBeyLD3Ahjwq+QOelAi9AWsDNGrCt3WTgahgbSqCPgc9UQNHXCo3FzbSg0s1a9UlKIyFeanU1AVBHGEScevVFfTD5BiOW10sFbiNPcZFT3i1FcVY/0VaWMwIOyY650ACuWuiB/A/TMLAAqFZwm70BTf1zh51I0lGFTTbU1DEiniY2mKIiPIkPjNopfFJpSKmrJUvN7DhePVJM0eU6mmzewGGGjZD6m4EKdyWfvlVNk6oPl5BcAgSO07yqmLOilFXlqWx1eA1K8obNJH97RSpQpUQ+8ICI8CZpHPJTlvickye80KnLU7ZrgwWnELAlRfTK/bfky5f6kCrVkqt/D7EzeqQO0EgPOdttJ3JvR0SJv7YiHnhTMkIB7SPLp+z6mQARPgrRJd/wRzOzh6yMKA6Mi/fGmaTlw/N+vl755BivJhwa2DgDJggqjrBwpngJC/d0Ub4/yVwADo4Ihpz/Cg6QQZB97P3A6djTSQwq+FKvQTkXEGfE8PKmSI6SkD6dZzJ65vwcFfoRKSIKcdyVLTFJeckixNdsT111StQOv9oGq0+9YPcqJj9A0lWkB4E59mCQJKeyPA1XHACLSIfp472LCZsCTbNcClKKGkMGOHMqcTUibR447mukS+0s4samYVZXLaml8baVayTitIs3pkfW8jrxouqY839Ogc+KtG/l35gC8BCUM9S4655enMczfw3s9Q06qbcZZsvZqBbvvB92VSlimTC2Xdj53nK1nR8kkTc1O5KjkTARQYbvpXJFfWuBLLe7Ueclaiu5y2ayKRcMsY2Z5K0guAFYtVQKtcS7YwPSRQjGhATfr4AXqSCKCOAL9RjhRGcSGcaO3U+CGpaDu8gWrMxgMIXE0iHIEFrRdZC8e0pBtMRP765fkj+ZvJZDsvCy8Gc4Y1WDWSp55ldbAgHroKxA54qz73dsYLNn1MN6FjgIJ7kR+S9si6tt2PicAn+e+xXFnRezyESzXEOe9VcCe5umnwwPupd4UMgEgdhibnJztTwpV/FCAB22vWQLeYca7G+UKzCagK3TCxIP/7TPalK0Yzw6aZVWcPM/P2tjoNLsgw98AjEImttu122WNT5zkkHkXcDwehi5uPRILmLkLeZsi7igJeFCEe7SoKPwZTRJGkr9nnSP9X+B1v+6q2Pp94ku1JWFnpGv0OoeMrn24uExATfzUOrkrVdBjXhTfGcX/DnuI25xzaa9ugwtUZXGNUMK1VMSMynqmjwm1loVV99znsPaGitiHSrXAcR5+Mkul2x4nIHlP6S9A+m6VgCyc2eg4Ut0qwMPzH3JHBJE+2zfIgrNWZA9OR1fI2Kmw8cXeuclqC66LGFGF7nNJ7UL0JDeTkfIjgvQY5KZvEKKAaU2DW7l9mTQ55McSywb29vRvTvFd6t3M4YIhPg8gXdZBC+x0XC7XOkAElb14AcAL8bHmtaYj3k2P+Mmvy8UHPoJ2bOO3ngegWWIvUyr4OoBl3f8ZEItXzDS3E0ek4TJR+SjxsfAdzf0yeS+mRBhlR4Roun0F0Gpez8Ryn0ZKotnXDHgbRB7Kuz+h/aw802rOFyVwuwTdeFmZxuqYM8Z1E8QCg8hfnJMCZJIcr6QZlrh+a4+ViaN9FV4bbPijd5ywO3L/cIUnog36sOmmEpsQNt/St5l9v/uZ/bpcTsIFm/Fzfo4BlUMJDTxA0HySM4KU0kBCgnZ+UxX0X8hd09xhFDrDtjT3Q/7Cbfo1JUVT0a9rC3e1oUXVT2a7pgw/OvF4ApcQduHMqtupTgop8pvQ0ajycJUplBpLPgIgQ57e7XaFje4SNKLIfaudYw9DtHL0jF+c9QbzuECBaxwZNxx3hqTzblTyr7xVdoK1c4l2L9LomiGo4sPZ+FKcMW8fme2JVGZ3ntrGcbRjCPoqBZULYAflkkEUQpiGj7Er7vgxwARLELxQN9YDpN+2ndU8jaStO9Us/SMLJUyJyv67DjPLZfFuOANyMYL53nkzKfCGMbrF6lbsCf7ZVv+LUwcdhnThL20MS5JMz9hfhzg6RCBdaOf3VgeWVLAACtSe2RYbsEF0WYLvZzmaQChp/TpMnolXJtoiBMZtsfFpFFJX+8wRcbaYPh1qS5X/mwdGdGgn+aNREax8yYxMx4B9eWuvLNKNtoxPST0aaQRi36BYwklSawmQxyNpdWzJj4LkEsEg0sJWvsp+INs85VFGA/u4LamRrv2NkZiD28W/vBHA8FSwryjlbQt4yGxMyj13/IN2LMv0lKK1/K89Vg+BVHfev30qiVgi6vfnhZq9iIxwwzXQxhgfsKsX9g4gX+aMxi++oanEU2NKSns7MZL0U9xHEQptH6qTeQ+PoSX5OtMXGVEn2L8DrBLYu34B0CNtU/XP7Ho4LkcYBsDJxpC1fMnzggj8GfmMVeC8tVw9FNQcS5B/71XPpMh+H8ARuJnLumQq+E6a2bSaieUjmDDd1eHoRhObtcG7sbFVT1q5r3stFXxhUWU60xd/ShcfM5KLumEIyxbSbFWYvQ4fnrLvAihHzbIr1I/jrLpPpi2qM+k9xITRE6nD8p+cD2RoR77bCBb3iy0lZsVTp8NrLTkN9WYdTlNsEKiE+P9rWbo5umyHIrU/1q2oF0qa53nOgsABSOQQSgIOaLRR3bX2oyZtjFf3PHuvEcUBVikS59LwUBrRtMBXRyyrZvrIsqWqxG+oo9g2LKi+NZPHB06nTVWhNfWwA/rCtLHrMWkK7BG0zUwRWdp3tpNN8NB9ixcl60KaC8SaxjRWkYkKbHrxyYbFWncfTcXfk19L63J23G1ZZpzINvSG7pYUGXmqEYM4+c/1Ez1eYk6yvhVmH7stAMpcQdCMQcI44+XD34+pp24aMCLBxhmlitL6xLW1QeHINVtpRJvwKsXQVcpTM+eBxSjuHTf0mEp/g0uswacePCUYck0b1WT/GPbMSIrQ7Hck0RJFUpSTf/V/rzBTiRUut2SO8Jqfgu0ZmFiHSML1qgdqbqfH5jLjYF6wM55WXyhkK280RKOjVo4S8R6hp1VE0W6PoBCAo4xR61C0oM6ywITnIeWmT29hA8Z4HaEdWLhvbKBVRcgIJ1JdtAQZ0Ll8vm471/qR/UbptSaV+BNezpw/w4XwWaWDKrCh3QI2cac15qqmUlBHog9qd35BvP+rKYaavIrXcPgKcUagpCpveSzllCwr3IQ8LL3/RLQL8dCB2oQk7Zm6niJCgALrMku2pU3AZ3CZ/lpNrmuHhRkR1bBL4cRIZLXcOw0UHMLJQnsfpW7olaFTNgBNa8QVsQsZQgCyoP4M7vdOU7P6UswM+o4Qlo+JPl6VjKng/klUkTAJQkjAYuLT7/IVIA6GVzuoTz6Rj0r+r9UDFgss2Nh/XPmC3k8XEqq426LGXP/C0y95grijA89S/xcJlWqlomi49T7ef1DT1hA7OEOmr8BJox7xHgg2cWMbglIyaPlEzjko/ZMfJq4afrwvZDHzgryMGkHQFl5BlG6taz6XoiPcajaM7H733NWwEkCGeVta7TGkqv2a951EtTA4X03kl19RlxSToM+QNRAnmxvjJHI+m2/+WDWCtZVhiaFvlgsopoBz9ve9Dfch8OVaMBYS8GAhfMtRjoj0QXy9/uPWm4LfclM7fGST5WBL50n70jFuWX20eM1UOzDvKOn9y2nhVjxkCakL0T4naq1/rNtXCJxDLgdDE2MGg+mCp2lARtgUvZT65LsKwANPlIAnqwD7PW5rWcx2RcmT4kJPNPbjX0j+tgQrWEwqGy953wuTZvqkpZlYYnrR1FLJUhOYZ99Jt0Fcz9F5SxdRGJ55dF2kqSeMF7eCjQx4FOunpcbQiHWvha/anzQhcdhDgKZpAQ6CLLL2qRm+tvDsZs5EA5i8XwXuZ+sQKxQnkyJJBzdt83VMXl9Q2Zh4JpXp9yYJwT81F5v+TciRwjvyHfr9bZVG1F974zU4sqHBIENxEYLgQ/zZ7xVeOER1Yd3TFvi+ZEvMLnY4gu1OgSvBgIG3VQaQJZam89ZdyrKghiY5z4LGY0hGis/JdfKved5LD1fiOZ8weCdf8MXp70sWKF4da4WVTnxkgD57t1f4D/+oqhG7Tj3Q01P04yaa0OtfSX6Pgypr+vD/ykmY7mwAf5BixqhVeVh6QWvhHslXUq2Xpt0pjia0o6f3qzHh4QfdnQQpd1Wk3ApI66dJuJT5vqUSZ+TSiDsww5Dw1atxv0d0ETHEePURbkyPSUNVBWhpUhyj5VLcs+GcJe8GcfOOJqBvlP75XSz3bw9QvQ1it2cgBgIqCz/+6GLYVDkkMIH+wDFx8gAHkcrO7DZ86UpJDlWRsCUaiSrnUaFNHOLlEQOZhV1ufdCa+HL7lBe5AJg3/5IpGVMe4tNcFh/LU2rfdTirkcTcKmEbfaCxG4TF8DCanfIvhvG8iPLVx744/2IMQr+tiZ7P0sYELOuQGBdIakl/X5nQc+6QwUANtdPQJTXTjUugSFma8yibJkbmlvfIi276S5oEm485JtWY3wGTGz83hWfJwhIj0YNY2o1Wxrrmbkl2EJDTop7u41DRiIh0ILCaRHdB2iIdDvZFDu/Ilj6fc2FTeV4RTyX4tZLW3HxyYbB448KSVs3Q06I1ralhE4Td++Uc3BQw+X/YzlPdYVUs1o7PinoFjgt/t4DYwMPZfKcTMfKXXHMiRdGZnW1x7F1h3ERkBf4//nXUBTyyy3cM1T3WrtzKc+ovmS/jfgZSakuCfWIVvg3IHjYz5JdKKJiBNX64KJ/fPE4+vlQJZ0N9Wgp26ntiH/zRh3SyjLKzEKYvnQTlspJDWKk3PiAOzW1beAJpWH9oAn/Z5SNAetQf2/nUZsM2sRGDDS/T5bc030HSSdoBYJArTOZevuVlKp15QBlgoIVGhQMqvqP8o7mzoKelGxl/l3jU43tze3JUJoFy3JyZYD+3hFbq3WbNhEIS1WxbaxfzbNpCfnc4WxEjv6OEdwv+RuaZ+TjW8p1LLocrLXK4qlna2Hkl2mDsMZauvohJpZVacrnTYi6momcFMnCw9eFyjM9Dqq5mJEohhLVzX6vzpqCzqcfaVAOQDIIzNJd4t4s8v3V75niY1hR79h+oJRRtLIj1ldV+OKnRTuEX8ZUfqGUNQFRKu0d77e1k1Bhwd8ANTKoyScielXAze13mDHaZ9gMXSFnCACVkaGCELse/y4Iv8MbMkX8/p8CseidJ50F4E3MY6VTs5UR804izwHkVN/SlQklHHn+nGAP7cFphaeCRlILnRrdqHbUG1uDHMFfNWXIv9tlIxTGPc81nouZxmMx2+zKIBmJjQL7MyOTydUfUl6J8BXnaR1XJ/RSMCmFeeCGXcgdkS534yKnUb7oCiHKXCDgIBBnd5vI6Ir++njnVJKVYsDVpV49PTyDsBKQno7IzUcaCWgUUa4UoB0kTAHlkHvXJfUwPDU8JuGTQvZxRwV7GWvmUZGJqsXGkGLZbxi390Jt8spBK7Di1vCdoX8CtOygcg4ZoEuEKuwD2h0okKU660Fe7hh9MfGU/lvdiX3HDVnRBeV+e8AFqSek5O34Yq4RaRrATOt8M54j78tepLGr6JeGldPpiNB4QWB2EXAugy16OTqP7Zdsk0HCKT0KI8HB8uKrmNj5XT0aHaRUxGVlaDEc6RkKpUWPXYbP/4iaJ2mY1kbd4aCG2vLcvVVYngbfVb7m7K87Znw6PiSdGqevMSgMyJNsqEcJMtpU8KiCGNe8KFktKmwfQfCazzWFfc5OA5aSGEcnJaRt3zkPcmyS5OvEVzyzz3U2DNb2CQI9AmWYLu4Cah9KzCbHvgAIPB88FxbUeXHRY2IgA0H0WVL4UcTmd59VHAMIRuWZCr/inL5KxN1flPEKTwPgQ8RPFP/Jtqvyq2KTDteKgJgmbLH5UQazCsdesZvNi/ODhulVFAd7S9uFEGAL1a7VsfZvoxsbJ9RzAShfMcS2+nMfRTTglNWME/jHu2Z6qBMq6y6P9mU7v+tdVbC5oJVfKQ8gpYMVb7Myc1Vn9+s44EeX4UTBqtqcuG4b2nndIVP790zOAWyC+r4ZdcFW3A7lyouGj/LHCgxYw8hS0sTwHtj7BoIVzQyryI0Wqu9oaY3kI+0DUDCsq6n0lyfFo/bZAj+OWZ9IQuwclqtlKYU7QCu5knYdyjsMIcXb6Pt4SR7eYOGia6xahcNNYoNz79cWTyyxUgHosXSXf8CpT9nHCBd2DnaQkUZdqP2tEUjfCasjZuIqApxPOMgevezZduyF9EQBecb4kCm2xdz3JTK1D2gAHnw3PY9NDj/jKOfIHcbIW2RtlZ7KrLCtQSXJGbgHk88iAMkClJFN6UplP1JQLetK90V/Pf9b+qqFOmndzQMM/uURL/BSwFFLfVF1dxV7VuAw2gcxBmB8e94dx10IOe0y3I4dKvcE+/I5fYwmijd0DurV/oFL3vy8xrOw4kNe+3mxRBFdqmQbwjw2pzajfAZm6kquJCiIblA/I2gttCvaTKzeunQ7pMhBGvT648YEq7rZqfrS/rkPjRWrtQOoKE9t6eGxM+QgncCji4RDIoeckgUvdoiYiZxd0xr+3/52uKVwPIv8fLXtzpc02fdfagLkNCFXG2GkjzUzRilGIdDB08h9m5lZ4mvgaRRSFYIHFQPZk6VotDoDupoZbPHKsuJFW7jgYXzeKztGAvvzEu2mmzqQmrUz+BDocIK1/sRj8BVa6OdOoEZrD9Bxws3IPbtUMmXyscAljTf+ZqaFYDw4V8/5ufufz7t7cY7r+1GSxLiH1A37ytrqVll/v7Df0Ql66z4kITG6jkiTqv90KyI6oDtXvHG+Rcs9UuNdbIiNUtZrLs02miHh4RorCSSYVlIyJiYP4WtVrbBYAlHECbCfrYxmCc4dyUmxTxuAF/kmr4JR0CChcYbwJS6deWVvg2fazR2bY5xPdRTIpKhiCXRhEUHsDzaTyTdjvSC1bd0RXzHvv+tedXMXccEtFRukEa+JFPBMFom22eiQHb7cXdCCGa9FWYApTDnhstye7DSL1+TwCJvzx0xg5hZ3Kmq5Vn910nxGndLAI0ngpa1EFeMcRt7M1uunbhdmXsy/I8W217HFYL/NJNbxfhCjlr75jotEuxOkNMdVBiNJvZLR2m+mGXLzydbj2hv6Z5hgPYEThasUbjr8t7Re219LQDQhBrxhFVQqYEyPXoJjOHj5wNJLFSV7Gbtrqvd8KCeLsVwenL+q5ECxHH0Ir1ZHRE7h5hws7v3ahSMMOP6L0JvjiL8yx0upEFxFQLZ/yqJxBijX94eQLjbee4zzKNdn4VbLG+qywR25zA+jCLP/cHZPKdQRBIkyYoC6zTZkwLo9uyttmoS/CjbNMUQKgCNUvi/YOJl7uE0KpSoBhUHLNGiiE8jAGKGSrWZuDmiQdpKHwwvvZDIisddYrS5Y1yI20IfcgEFBz9B37CBJUFwsynoqiN1U8uts1gTOsNrZrNAWX0BqQeSitnqNOM+hykR34RE+9ukOCU34GsKmlrvksquuj6AdPgX27kSCIpMF2DeTPCvYvAVLEKuU42upIVTpGabNREi1YxSCra4okZnDxddbJjPZ3WXgK0MzQipuBqbQQuQv+ujeGZseYn+rMK+4RQlvPvRgwSi7FJH9iHn2LJ1ZhsrNoUoHl6TjrgIA3Ok1TnoZAwfvJIdJMZ/Zvt3ANgGQZWEpPMmArn8jLeMvrtdkiwJivmdZaukxyer60X0x7fC713hWAVeAcJhiu1G7V1pPVI9kTSwUyt2FOU72fYFOS8HJwwSUc95wwPaKi2yWalpj5SwYPdKGxotkERRO1YvolgrF36ZEZSsshh4ZWEbsGC3MrQ6tpTslTwNm8HzfFwpYpzGGgdnCcyPDytLTxMEP2RyH5DkTsQujIy2PUioEE6hHHoN4Gz//MkyEgLk1zQUXS9DKzS8BwcqES0UxR9VpAAH5FfQ6x13QdO197KBPqqYOlWjig0N5PiPpw8lWKltrheNxoBuBZI7DbpEcY7u1Q45NQnOa8+ykjxbXvMYOCFyJnzbV2Y/YIYJ1F7U53CUFMOLt5NUzUpYG1yMv5P/ZZm77XlpQdYeG+2m28Z6oNJCY2xVJSre1cZQn7AWnO9+Hj2dEcxq8jSVHr8+u/Yg8WQ67dX76y/kkNJ3cRXa8ryb+vMbX+ez4pe+UteZYMvGUczUzeMLEPCkW78+BcA4n8IgTWu07ibelDJpgfrhVBEYb4m4e+5HtGnF2aZbtPmiYDPoZ8U0F+0XF6RINPf5i1NCNShL/ElkzeMRfUx/yevxBFUc0M/N/ax5fDbtmpQ77rqSZbAaI2O4rk5QF4mofs0WOf0UCxLjusTef2+6vlkMzjB7dWVpW9msTcyt9Xvg9Bx9ni1IOCD/0MbKjgkN31Wd4wKqzcHSIiKN8IkHMWpicT61j1bRlK4vGPXWHrAU6dpSCjBVJCjB4hr7OrTzsgeVObwemo6pbaiAQwn30t3JHuNHkXOcl2+jhpHhHuHpOuSMMo1hqJ3WzObhyDM23fm3qKFfSDA60pDI1/hfvMvCAN1AjuxBIOhx9Ytb6DVLyuSI/w1iyY5rSx8dz29lO+qpEVg7eFUJ0tgomhqqyhAJ2PcGOEg+dzbyNSIFprzhk8fiSMAKTdV3UKpMDDgdichCyDqZNgigqgG2VOzkiAbBaEqcRTyLwWK1MYfwz+Zv6sMFjudq4EI7njW8z3ZcqgIsdZfnx6cUhI1ZhISsuHpPGV64bowLVmoQrUGG+XsTETkemb8tTd7n5oBaybVdIVBUB0QaFRjcbpM9If+ZV8NTCaZrP3onje31AGKJ4uX3NVEtnC0O1hBddkPYHalTTY2ELhepMiVxb01MPzyXSDExVe+Oz5YO3XnPnDrhmfkALU55wqzCCWidBBIzXnd6PyzwpvbwHjT15IiIcoGoefnQ7uEJVFH6ZKdQP2CZvZ5lo79FBjYAG4HNgjWovfWtwNT2ItLlm8Fi3J86VQe7y8VuTxEeYb/WvqLVEHtifXaynNL2APaFXsW4VdrBPzC+2uupEyve4k78WGX3qoN2Q3lLrIZ4bt+gNarFM4sPqKg1uc36ujE0gVg1ZiqmDuGz1g0OogiE0EE4Oak0vP4GhUXGk3oS5NVU4VA7STCrjokRqfFqsz6ABI/EmNuD/Z/Xldiu4FRgCq3nG1Gay6rXP3cPZUg3qLOmIAkiDG57dJ7P2axUrN/Ck/3ZU2SBxBIFz1dHcEXziUoRgOXqjGW+rlLWs67/0X8tux3px2DlX2bsTu0SsOuBSXeg2uhXa/ERD/lSRRb6rwtqAHS5wBZzGDSICNnteW7DcsCja9gfJQtzWoiZ7m2ztMnNh8w+EK/m9qA+p1cK6ydvf9XEAiE8BM9zomHCPUjWTvQjzPakwyy8YYDVNxfvAxeGNvsbcLO6N3k9IRwFUfd+xsLKwSICktOENGYj+bQnlbeUUeY4HOB5TkDtYUURckqbbMwVnesy/SgSafYmKN9wKXO8mGnD5cEyDbsNw4WCCnwZgNfilZhehPtirHjAfXeYARL1U0FQrEu/hBtoLsvrlOuFL164Jlr5Vjp5aI2uh8o8ztW6jQlxZulWYJR57vVKRlPjZ9lfIz2gDsh1a0/yMfXVsBM12hO0EyEuA4q+yZpVvZwSkhNFrqgIJ4i9lSXwaZOORLuT2MktWh99LUF6VagsYMDO+c5RcQmVAsutg+z/J/HAHTYeo9o4fftv3VVNcDbqGvCqMj8XY50h5HISeKZGOrvoN8S8NpRxhnV4nwAktXf1X7bNJ+Hk2jzEyhcXGbJeiwVexUHH4lkh533V7Jn8ckdM/opyXE/vD4FJVaZixwog0y4Nhn5eMFDhAU6uSqtr4pJ8yYsQ1PQfiF2Bh2cgj8QwmVc00sDvQWIW3mIZWge7prNWrqCavjw+locUcVa2hnz3ZZK5eY/8TrM8kpnRtpmsd/oINgZKsvYVNtx50U/hgayeXVEsE9YmuccwqthSo50Jc6CgJEY4SwX8WDjlOPKdLaxfjfdaxPgkLcufJ5tco3cf7BJKRvovPtI/xpCOMqIM4Xe+RdpEDdI7ErOZ30aBwn9UVsWo+lKEKJW4CBoQdwUVudCvHd5aOQUAWdHrXm30ekMfslS0+/Fl/WbclD0WBnfCQ1hLzQEBQfbNCuE7PEiZIrIjkELBFIw6rlaNH6pvuxouvrpRr1usaEMgsHmXu4HluwNDrD3yEhVZtvRVJCq1iwixeD5xFvQco3PWFzkTJBCBWORB+4FcqvGUCAx0aHkdk4uWR5CEboIKUZmwjyXYumO/ae2EmmhfMr4LA2TQLAs+dV9oUaDac5nQtTH0lVoNjR7B1qJYV2nqrJiyERE5//rJbzec+CS89sMMAqRBbXrWg/OI/swQ2ladqBW003Jvu3fynF3vB9jDC3ZFTz8xQRQb/a8A+9rE9KYoP31y42Rb8QkvWEoKBXccbjhnKBi4GTtnJhBD+RSVH1fYA6vAXykIrzGZpn9aj3lp7ISIXhbhoFqn9mYUlYxZih6DPrdkoYiA5xTbUZTzqqvNW8d/0JLOVR9VQB48CNiL6knwyjmVNouCINMK/IMYhK0rfqtyhQuerV9eUImPUWdasNI9BCcYKUHP6KLK2Z6HRqHddFXH3MM7cSOopBfgpafhuwOvS1lT6smlRTKAorzbR1RGoyYAhS8T4M4Yp6jOeyRh8tI3Iy/X6SPH5VDaZKIsIlmctu5IZhQlg+kI4rnDtOAsT/rJxUzcwBirL3XlyEWoFwjvg/hyMIZoHrAY9tJUkguBAaOH3E+OBb2WvaouWWzi6mA8txDtpYSmL9cScuMinAxSGcHtz1FhZiAP2YREUHWPHGXEPpPnAp+mo1aLb+9t9TBdrnHTnLEo8Sksuyz6QNryigwjWvOXuZO4lPDOw1l5oL5jIIxbfnXisY2lWLEGvvccEjdSpjPts9FA5jsOEcHetRDekQJ4p2Kl17M8V21x7Rpu4OmrfEHZhSy9mViJ7wJx7L4NU+yNlFsII2nyXMHtaDkI4k9QuKa47jxVvLIFgj4cMiFRbWQrIO5vkAi4Z2KDgPvqoGqyHNxoZl7JJKNYyp+bgVGo4gXQhaq36jHhOX9OR1geeFcJVyyEBUpb5JDL3v0g1mjDqycvkLM+lDLjiGvmQ8oQ+G6JawH80qd3X90vdXq+oOUoBe4ENRgZdKyz3H3rCOK+JSjNEcV1s60g7Ypsf5+6krNsV0VFqk4YaS/a0JIFVdI3BSoHCS9rdHduQC0VvjzjiiEe5eov0IHuXhe44GpkIFW8GzCIwfTzQG7QQ8w7jQ7Qd68HXpdW5UXeG+c4yHVTMQBSq0hARkCRHCq0y/7fiTUQaPVyTNp7yje5tXITXIJ/rD3N0pEmAQIxFj4MO3hjjIw4kXTZqENWrRxfcfM9mZca2q4bJWTUPNJRmeeKNj4nCwWd+7V/PopMlgzSbY/wz2zvMrzyiVa4wtz5PtheDsQa7p4bMeF7IIU5FsOAzZ+DCORdVHpGWkim7EXleL0gYlRoJoZc1Fd9reIiChnwKZFfLCU7zuIHGoj3zQU91ECKa3w1BGvUhdf1A/1OhnCBJprSn6nMmRVDkELVj2nZp7VMVA+zDEQAputikVMKM4nTblkhFEu1AlkppSnecpEsAjU8En2ZR8XJZROsgmJGFSwUMsbsNOyNkd3bF/7qa1FUxG0izg8H7T0YJbX58JdaiKzxXxa6ClU/yp4I4kywNm4U6Y+l/2mVrAaCxEdq0877brmI0odNJxgjEYEQFeIgsNz6AL4zfeZTr06XHZl1KdDgKq/DhwdRYD7FHlFahR1uOszPZauSIrr95Xr8R4I/iQ31kfGI/khoqboqX2Cn4UkFO2PlZTl2RehgeE1z5DDcy2aFo3f2BweQyjzm2PwxIHtVVk0sQzMm/WF2yP4JbYZ74rUMyctYqqJ+r8b73F9L5bbnBuy7EUZBpzxH2nPq6NLzgR9Nvmh53CQSn1hSVc48XcAR3uiBKaNu0n+4AqwWZJ12s7emgcpQh7aEwP+h/ECcg2vXkXdmXNRYI4Md2lvk+52Td0wfLwY/pKEpZjnloKYErBCXxWRX9fq3NCi/LcR/Sx5uQ7l92oEtLbUfHCyQbV6bYBco32P77+e9ErBhcF6Skma4ZB2/9zwvIqdPnXE3oKNWNRKAOSaU4QiOFpCdi9FHvlF1Qzf6oAWNUrOqPkCbNyE+h0KVJ45IYUWV9rVltvgCWGjsO2UcWuQuuWmwbUw07bmkkBvw9JHGfh6h2GUKghYNOyO+OwDl0tS76uQIPGh45Fs7OhtzUukehbqIk/UNanyXqFjKf2x6dvNp87udz41c/xRLO4kBN0+EmkJSLP88lAsb8mX8nqviTTsaw1Yi6Zc2u0xXMNXwwC004mxk1kW4U1m9UWaTd0mJHZIcR1Hx8w8VmM8HOgKKiHL5fj8qFY/bHngodSLAb4UREbE8QJD5zmRxVe7SD6CRVnfABY+ifprucNbZcKd7jE6VHOS7b6TuUGH4X0KvegRwfzuUPiPBT0CN81xww3QtnSiaR1W5zymF+EA9ckQNyhSfCj+oLnzx27UlfqTUhES1gKUVFQisDjy9fDE/Ppw03hIfpwEFuO9z/u7uWDslgwplipRp49BEdU0XyDtawPtnThNGUs3I+Ems69urFtrcud4RX/OClLRIoRs3oezOGnv2HlpQPS6VBiofPv1OLlwvyuAfrWQl1F48CNrg6k6QDfMXbUX6p9glbUw7iovf7g614YVuDp4bLY7vVAwT5qalPRIG7j285x5I82DdW5YqFcFr69pWJHJ20bqZ1894+sdFWtSyxsp3FBzSrflIdyZ1Ea75QYJX/GdT49jlDCJ76ECxyz+TXGFHLDkKvevmsZy39S99NgE5b3uV5z9Cz/yNQOq00Nyu+uz13VyD3+hY/+TrGt/dsX0GFVyKoOi0quiaocOgWTWshtITuB7+q7Ig6s9ZYkozTJUuDPEchgs8p6DWf9OaBJJBQ21IkH2f3l03uoQP+ClBbolr3EwaMg/GUHG9Uxwfdp6A09nb287Cjh1ax9Mxx6A7sMLa0oCOSnG2BhEXtCiK2wMLBwZ2YoJVbn6NFR5N4tbeZhQKmxAsKgzYonOrKLSsQicZSlQGO2UtTKMqPFqcprNM+5zymoIE98y06RuPdaTUr/o4N3nf9SXrq+oy0wH50OhBuYJOnSvNeMVwBH1OPzhHt8h6QXaxBv6xeEoHODIwqwqBh1hNx/vLIex3dHkp4iy+Va2hOG3YEjNTinxSAsc8z1V1d39mYPKAMiMeAlQlR6CNKe2DfwJY13wcwbpEg/o45+59TzbW/SRX/uqDN+LZg2suimQENApFyCn9aKHZgjEhPWxi7rvmse86eAJdItRhawBUQ0BGzS6vedLLjePMLt899HMFL0JhtHu+o0HdtnVbxu6jhJoYnXuj6BHZiqJ8bJHUAdIdQZBzt/+3pv/0pLJfdm7c3pUX9fam1KX0RmWRdkJSfjAPZhxpQks/dSKCvQvlSf5Lhzas6X31LPBZ9w/A+fM0Ny2A99M6Y/lWJVtm6+gR24gWdRy0a6k92BHqFaNJyDwm1WCztn7pEJAepSfbpEnFvcpsT86HpWy7vKDoOQGbLxnWWE31tHv+qXuGE3QWByozAmkWQI7Sysdgp1a9xPcHco0UsfQ2lCKYDah2mWjaKuHvuQE8aAbXpa6gzml2M1JVCMsApOmrXx5wWHYOHJt7T0UuZiDjTd2lCF3ILf1J2xFugUTtYXAb6ORWUw6YkwpvAcFLEKnMZVfGGZWQRAKx076jG+tyhCMn+LQygHgNfwgu593HtbZOIymCUCLATngkG9z1IZuAS2xTY3TAefnXP+Zw8Eg+fEo1KnwjWELN3RSsS1yuz+DADSPMMMmh1zIjVkI7MeTUVEDhSjviO6moFlgSZ1OFWASIyVeJUx6WQa6CT6Be73I/qRChUuqr5i+unS0zOVK/NlDaDWvJltMejmB+86kZEp2E04yoA2+PgpACd9L8KQAdZJOTjWmJ1tV34lB2BG2+ba6QlHQB1B9apJZ2Pc7SU907gwUhdOhbowiyHFW0U1Oz2bNKXr9iCJ+XY5DPefBtQ4f5LL2XRLLyC3uLq+AAIRhfZJPgbuN6h3IyG9/Et+L2GEvPHZoNwfEDzU40ZWvjI97/HKg/Dxnm96A1k+0X46zvHSpm/voai2zoo3ZfHVPZyuWW3/SLlh3cOzXdoBLnqs9SxA8IfDH/iQv0PLKkSKUGN6yNheTmh06UQ/hE0cz4xFQZFTHznMW5VHNarY4YxyjFkU01JC/BTQ8/ggEEKrTZGMO947eDrmBdSZcnSeKp6AmKIEGdU8qo9A8CzWDXY3qN/YhnykxYZOlEFyyFv1OijxegAx1A6lFgNH82VLCso3bQWjGIqpPKB6VPJzwylVqswFx8ecZJJVg3tJRqGRlEFj/c+SClY74U/bVJzmlHOnYQ81VV9fWFCqAm49gRw8XZQ/doESONhIwSeI5+zrcz6dKrnkm0aT3vBMgY/yEFQxs087y9dXcPkCLkG38oOg5TeUfdA3HZb3QIakw+4cZrLhyo1r7eubKjGE965J6YDPfVW81vLPiNVeQw6sa0TYNO9sPzeVcXl0rD123OSV21PQhOWxtHamlHjzdDnoXJKILXhpHYVDNHY1USKVjXLyD8CqGAzUzApItj6wr1eQYNSzeQ1mmMIDHrNtjl13osQSSNsSWVmKN8YF6rLx8FcnKDuE6P5qfo9tC5sV7w5bdaXQkLbHWiPulyeXTiLdWttwF371guiviSh0ggeAnIHlWZ2XBOJB7X2GoKe0XqZF/bWuObcR/qIs5YqJXJN4tCOqYBXn5j/xDo/SidYd6Nu12TV+mD8QQhkXPOlzk/T452CIdjWTwoylRVO/7sAtj7/85Imn1cYEYnb9d11PgCqhMwyh9lrj2fxyEunjDAiwnp2zF1mQE5vd8DZX6LQpKKI7/t8TAe52mleSaMhzLlwQH9FptZZUFaGQ4TcAKvaOATyy1wTzWFFLpDsRTt0SlRjYdbcrNMO4JtwpKe7y0pJVLibwLx46KkMeQwfxGGt3vcu5ibjMYHZaNgn+AkYBaD90m4mH05sVXikw+SEbhu2luNvrHRjyE9mY0DbvxwC9cT49jc6eVbCp4zHcQzpT27+/+xYlOOjX7TEH0bYZ21rjDsvMQIbHBl0O1pv79gscFRGckF9K39WElpqTVGvHYQd80F/uNxtVBGyfjChrlKI1rNIJgmG/iz4+NW/Q+qvG37bbyjbjJAZ3X5XZmRwuuSAiI7OqEOd+XwHyLUg/ygH/jiBapz/pLne2LXTlOr61U2gwQVTRuA4kHbtXSN9RuMyzMFU0cuOD5LnMOGQ5/RLRdrtqExjSnm8mQnOA/kXfNErGg8OFrRROf1TNXCVMQYYXu0jl03ebvjrnpogOuKxExIQ2VUFxq4DvxJ0DcftnYhUPR9H5ftD9dFFN55fq+e+tnm8pab9YLlfHY5fsCMOnMP7MY2VJcH4/MyX2CCC9BWnEw9aALzdNcSuTg3dkJd7Dq825yuunp3GzzDCbZ5W765h3AddEZd60yXGKe7iO9Oyqcs1TY2kV1iE4yDNWack6Sn7l0yuo1CCweeNXpuTuwPiVB1bvIygkmXZIjCvIZ9Iv4OPd48dFzWhq7jELFMbAx3XeLuA0OUVuntlect+s3jaI2lz8bK89OHxyXTsTZq5hA0tnJFiX6Cv9GKm2glmpiC88QRkCQTkFK5TdprZvRzl3kbQXNkH63CONX0k3rMb9U1sicCovq9BdMaCHyensqT5vW0jpn4I84g33vaT3Z3BJHwRuxMp+L8vOJKAD6zqtWPWzSvGBqG8vvnIT8KE0yKvLkQ1UAY9VKYlkRSvbvgvc/t7ipnXuQrR1wEFEgCsIiNyBC3bh7Nw/YeQAngAQRTjN+iUAozlr8kfC7mW5L/4f6WqtXM9RXgDBvXk6sx82mN5vdaTC4PSUino9qZVD1FyyRKvrTai8AkSu1Qjhdz8T1Mc4IFIf9fzFStWo0CqZoj/Jstni0qF7WKhX5e8qpKAw5zO9p1DreQXIxLUvaNRlD63ADp3ZZ+bP6Q3HUVqNGEN8N2k+u9KEQaHPsRcmABM/3rF+lB4fA63uCUnnJI7VwCjVekKGnFQKCFEFPFZLxHTdEv70Bp1tubkKr/2PnzyLbMGlrqrl57+t08V3G2UyN3Hu5wx9hWgLC5e5M/H++/Oxr1/Mr8hfKurTXPfRukXfFV5anleirFmLDKYraEx1xO9krZaFwHUTavn0gZT0yB2atIsrZGKeRhpDX+lwgOG1/PS0z0EN2ORAHoRGIjuusvFxk0zirkZYDQIr8jFyKHQ5WFZ9ptsdaVTWarmPio5eSMYUiqXbKaUeP1C8Zvd6Ldd+/yynJfBwi5T/c44D3Xnb/YM08yjGBvbio/nEU4H5uusN945ZQuBBLe8wnEgx/76kJ1m/FyxD2HPlbprf3/d2bNcdUAJLTVjRxT2doYSRTMXdWJgWad0ZKLMpNOq5cEdR2SaFqIc6LYcFqWD0OPNHUXIlUBoRSpWTKegmCH9E3Il+eApzSISWcEBkmgJo1qhM2uA9KFLX8oh5u25B46+H1YDp8rsw/vZqc3yHPXAJ9awVw4SVtRxFIg+5ncW8qkYLWnhux6PjaaJIgPVjJ9NKGObj7uGbAimsqJU3L/t1l1ppnG4N5ndB8KfpE84QeFn5uWbM0maQ/RzRk2MQ9ouEnwITISDTB62CKgOUJe/L+B93NMUGuhviBC/HwRM/7H74ogKW9pcXK+GpuLFdiWm21wh+Gn6+zcd6dGFlVgbvgBJ7ZW2i0R0Il0cG2JRh9pizQP46llzl8PZU+Regjta0bAWqwkIGgJ+8vQcfSmYLn+SsUn/6Yp8rDkNwluEw/EIRPNTbpf1+xvjt9FwgTYVPtdJx1xhb/XmMwVe9NPoZm+uRpjTrauPWb28PlqutcZkcwN8R/Z7J0bA4HbPE8/PYQplrHC2wgwc4t5NDIYM0P57MvOtH8BmSs/qCRBEw8P7QJoDTV00pMU0kX1t6g08Byc7uwKORQf02pP/ZDhjQFk2rkTBxEyjBvPBuS/swzLwwjgsSZSwegccnIDz0JM2StwBFJfkqRCPvEpjI77y/VbPkupdk2drBXkbWGRj5sp3Aw8uE5kxhZCaMS/ADVLDOn+RvWJdA//3QQMXnDXMRgG/mqBHvEVDy/RGjHitDSI91+yC2pWHk7CRUdKXWdh2uUKn2aNZid7DGNUPHx0P/g1d5L6xFXK/XE7Eg8txZW70YJiVom7yDrrXG1oCx+z2DFg7Ksj+JLQo1UeE2fxBqI0LT5er7nuBJObweFPrUQhUqU0vrkZHF3N1eyK4qAjB5Ow6ZG5niXMvfxElICczuK8OGl3XbWgHHU/fXyT7KFw0voXDvDRIgvbviCzYSz9ghmZ1vxfgnRF2leSLBHvwYvggjrk6YlpmnMfXzh1TCm6y8CW325Kq1bZcCy6UIGEO3Nm5hmx6UCYjh9F1qpzR/1xBQUlQoA2jVM94nkeDY1wt1B7z8Tc5vsuaYJRAX+GBw1T5hLXX6x97/aC1UN3qTU5Mjym93dfWpi/az/JcTxVbp4n9mRGx7VSAcKBsNH3vHPl2TW6ADJ1IqulerfoPzbhpRCKRJrMMdLBCJyWI5CJwa4GfXo+62Nl1rYvOwUsUbrwAgdXSo7SK8SXgj/RIkEjEQW0qqkqWNQes6+/BeVr5yyVLstRr2/V3hw7dOCwdKkSeDpKQP5GYSFA1SZio+Yow6K2UmHIvU5/j4KbtfufImw9tUqOOoiOYgCSF2G4qnvLgEd0SNPRMh18/NU8LlY8NJOi7X4KdqFkcSmUA0NVzKTndBJ3I9GtsSCEhmop0GcojuBbRriWT+mfrekUnCwLckH4p30aAnqqefr3vyHg8NsXeU+GsiRz8HwShe3xG7S9HC5+u29Zds1FzCD9NzZ/Nxe113QJjJSEUR0ODyDe+1LxqIq4cS78T5bESM2k4/G0VPraU5KuJituGuhl4mEbKQasfaIElGM7SRvv356Uzbhd6pGIu3YzWWrajsbCu5ec7ZudztIaVoPW1/FITDz0X5R7k3fQtOxWwqCq1MwXLJPntDEEi4FfogtuKJJorAtwByxa3U+5ftqJ5c4kfP9q91gUZ40fjnT2r/ooki5VJkWY4gt2VACuVkiveXOd8oP1M+7sEcfaCfhfQWgJ/Qc6m8EFCugT+I8himKoZgeB3tHeclO5JkRTU3whBn9K9X1jefcPPGmrqZs5+C3RM+nAgQCxygSII7VwwRNSQUTqlmOtidkb20Dad2QZmkvFB8UKj0rAvgLHnZh+Cz763TGd+XNol3ttAY7sx1H1lKmaMFyXm105/igalxH955AuR3CuzLoq++SqoOO7eUIqBvPxAD7hXazE0z+f+JSCHm8kdhtiTo5N4/rVoFv5MWG7WtDmP5T8wO5aACKhEGsAZXZuyAsEBb6rItffPpMcKLQVU3Cdbqkxn1bhpViACAz9BymmTAxTCJ3dRXXRK2aALToH3vXdIZi9zIMgGvCG588Rc2Q82GMGkIXF1wIDhPI9nIwl784Hx6NnPzloc6c+F0mx4XDEPKb+Nc21iUbFw6ErKhMcI1X7x2hnWp+H7uRXSZCCxIUdMaz+VePFjtpLl4K6cx1niuMcBvSPbs2EmtyVYuv+SwnjafOTFOtph4m/L/Usz6uxRGQmv3Sq1Gbm+rXqsncCSlJVCEawwqL1N7UauV/AdGWl7a1rlgty0kfgOWOAkCu3OjOOsTMuZkq3i2QMwO39byXY8iDai2n8uADQSMwMZWzzHOosc+2WRqonmiJlqH2D+F6WypV6v0uDk2g0GpBcGmrNPxodjdSMc0qhs9yv9flp1Jc75qKbYwiWs/JDvqQPa2Vr47dThLYTEgj6wD+nfnRbuQyGn82U5HOOOYcbgapSilOxeCAWXV+hmDoesjvZUXDTU2t9aJQr8RKVtiFia04qaUCw/KC0eVdoIuN12bqNfOI8HO95vW+rxCfOTv1F1pYrgEy9OS+hNCd+Hney+rLdzdGXXFNYjFXEaRUtPvhZvtP1hxpwgV8YHrnE03YUzpvffboaqKYUNjDuxecA5FnOwQi4kvA3AW3brt9lwkD20khn5ZSuDbjdLVmPEB5Glr+fW0qeB991OtQIaUYlW+3WBW+MBr3MlewmChiZODyrRV1NGJdxYY3nDTAeXpYJ2iAzLfoFMJZr6es5HMw0+Agy6LWmoHZjHudcUn8HbfoXtJ3RGp1ZFq+nuNmqWRio+qpgNDdp7RRAKbBzTRPG1cX0IULRSrhhxCGxdFmpzI0rV1+KlfNxzOn6Obcl2PD4XZ4QFfuGzAD1tozaEv1xuPEkTHy7I7UcnLYZfs0WUcmzUjDfn69SU7ARoZdQjtwm4RVSNYvdwLGV3WO4rBAKno275qdmuODnqT9TZfhoe3a/2G038aZAxzAWx5/FvoOhsO8+k80j/guHKxSW4dRLSWQBlYx6l8LJqYU4BBt4ZGYCZuhb5Ix+PD//omVcR8e6SF6IE2VXP1KccBBaR597rr8SpyZmueT0APXa2wVLuyWN2u4Z9XKcyuDevXk1nLZlUTOINvVjEnK7FrnbPFKOsj/AdFGstYWxau4e09LM0RDV+s5VxUsyw08UfE4oJsc8OxqdYeLk6wzQ3GD4FGp1h+Khnm/VxkzV1ItzLVgzn3f5bSZbfj9hg1KTd9JZceIkXEcaA89/d5dYuJX6fYd0JMpjTHAQmiSXtINJwpTgYObwP9+LDRr6kwvEj+eHelQNwPhfTS4hydxVAk988YD3ydaVe10QeteUibpQlW1npT2sjcAmi9B+cRt6DITrzqFWizzXx6sAxNfcwka3DRtFubnJ7lABwYU6bz4Cjqfkpg0g6Xbfu13daprm8YmJtGuhBkR0JLqGNgM9NdTu26f5yIjiQlPuPxUUHc2MydEKB385D2jn0VFO5xYnkMFJD/AV+Jav+/XfesrZzYQZuMqiV6k6AXrzgO9MasL54dloTzUF++1UhrZ35fvzn6VpR8VHepfRVj8cAJUEbpoTIZYLKre2tJ2gEqBZXyT7nktIe4eriwyl+XfGCco9kkylSHrCU1RbXrahhvrZPyWskm7J1AlqIXmnSgtP1WcHxX00snRfXAFBa2G+5q/sEBSNuQvkEi66SDNHus8nkmqz65ark24K6SFNgpouOBymjOxCAEU2vXQ1lQoWBQj+KJlMV31L1vqAvhF7WNg+D+cmlq9oKM836Et8/I+Nzai4agzvQ/JR23uNPFE31UNwfgrOH5s+YC4xy6MNXUjxqkEhb91k2bCdfKO3tmdNrkPlc0CPE6n395Qv8YaemATKSC/N0vz9ri3LphjOk1nwsl3ldGISNgiVS/SAVkZkPuCk4gz2tsrnQ4wHF4rZP86BTLH1DNrOuK0D1nMgulFcrhdvJdqtZTHfu5JgzWwWIA9stozVAwKGzussow1W7LLWZ5YeiyuopX/sOMmIv/mjPAQMKA1fxxAOWXXTeVOFLl+fV5TWfUffoLNusp95/I8/RAMJXgrPlqctobQWTZX7mWIDitWC3bzP49nV3qMq/BXtF5wzQZ8RFbh/pxbzYRYvHWQZGL9KCncUxhVEPNfu2neo3AOehVfJ/LhdiZY2Se52GFZ1H6WFeODOiJRwLII96TzV68cYQXR/C7klfhQ3CFHbF/xwmmmLvf8UL6XIhDVyAmJ0OnIF3pbeeXmM0m8Xrv6ISlAKHwcozEN5ZWMIBZwfo49zWGTFrCDw3yRX515sEEndFq6mfzaSt2miMzK98oghMz47MsLae/Hpf8pgaRFswdTsLbB3lyV9OWDzXRSu4N+/G7aFGc69u6byJ5wttZj7+udYjT0Uu7Dn3cp6GFCWIAYIODBeb2P8Nq9e9ew3TO8fnoatM/7dvjA8aiBEGeRgsYbMuMP1vaG0zRa8qUwmnC/FJY1W/GAvPsu6YYI00BQkvBrdsc+1Cz8ReOVqPBRfWSbuaBK3ENBZyJ32nv9fZ+ioTb5PxMY7oO8hW4RMc3x+SQNYjcB2wWSgy2akEToWrZNYAhZsxOk6m9/MOIIYAhB/TxghQODwTkl4pR3s1RU1xMwtDT14N041vBdBN7tw/LVCjYsJQxpL2z7tvQR+f3mnv9Rfcs5q43m+FJG5aIabYR2mWJUuiDFoE5w1SYxXO8RswZImSSDRgwA0IU6sDM25OdynU6iYwxIqg7hyn/21FUZBDWjteEXGECc5u5Ttdr0mVEEXGYuJbeIkdbTjr2T9ob2HlRZisRIvLEhhocLuY5F1bXBCMJbyPcae6rPfuQLWOgmUTJiTrePGvzVx2A808nbczyvWsqW493ysWycZpal8hGei0/W7TDHhLrvNcXQBkjnQTJnlZ7UAOIhwzfOSHhhHjZ976Bsfb13RjQx42l1BKPi/uHmQrExW0ght3fXziscNAoR4igmrVNoYjZmTbIoTK5AkbG6wVR+Gto6LhvO/3Sn5F5OCQI1xXO1Z6ndjZraDGarjn7ODQCC+BXxjrGCmNSl33BTZHCSLG9Y8NUmn1o3Uke2bYG+zx8HA/0aTkZ6HV6EvyaQ2K104sYPT3MCbvGVOBIQ4xna/QZEKmXkeCEAOxKIFT8PAoVjUmSkOqOiOBIJ+H52eLte/6klRpVtOtV8inN7jGUKkEamsBmoVreRFlkqiPikO0JqMF8t6PczPWGMvTqET1+BEcYQ/peXeqMuJl2oBMfMJObgy8sKdU0CwVE2CrKqzMlbB7cE3ZCL54MJqesjyPpHqz3GKZ9pYeIL+JSYYb8uXYvh+YWIG7F/jhZ9GOhCIvOnOLWmM1i/njMxiYli2XIbtYasKOGiNgvnaobOsjtpwR2WEk5z0eAsZWpxA6bAOVR35KiFdwAEwuBGJpvRhnmj2/HcDQg67vheFngzDtsSaWczT8Oy/81avUIWnv8Cvd2UQ1f7BDNO0S5s19bjizAkYEmCHIaeSxjuP3y2sFAJ7VsIDrRrQuLAQgxPoItWC2Y48WYJjDIsKNmQQ2a+CTF4KXbobPZr6UUGxiWPpakuHNA9MXfkYVL3MhNbTunsEYBT/0t3NcidABLFAJKMAZMmLrsqlKs4i8re+T1xAZuD9zHBqxaX9ZgKarOL1MXua/zmYsny9aW7EjUpnNgX0W7Zs66Dm9vPN98ykLWEH8BQHSgkUgtpswPv2G2Cr9EzLwCwXzVZtFhYTvjCjkQezbPaynzDkTy9v1A1xDphOnseRhX2YY/r8wXuPcMPqp52fcN6zoeW/zrRDbmXBb945J6z81Tenv2yRGwG6gcGumfHstp/PCI0SVtn9SHeBCuOZgXn1jh3LZ1+MsomrarSqtOB1eCjtV3IqEZfZw6h+PfmSNg0cgWsnDSnasGNz4EYBOuKjdR7u96YzKRdNXycfn5KoKGXYOaXHqnX6/jrCWvhAloxMACFghS7ZMYlSTgSY0cmSCkKmAiumZc4+IrbfQ2Y2oI+RcE0/EAZWOlhCG/CtSIp63M9IUfxB+RRFDowayvKayrcrUnNgI9thzEwLasLZ1U/ytxsjKgUjf/Ae13UeEzYU1naTvjUNufs6yE/qHXpN40gEwe9VF6+Jopo7KmOXj6RuADZhxmmrCfiZUyjxH5fuEpRBlcotNrkRbjyTeo/fSsJClx4fhnYPj7uUG4TN2N3U3egEoOM1Z0hJCsCEDajXGwNHYzDZh0NLeFynIqc5rsxDjgwBQY8nWIop+WGDgE/LkxCnu6oj2AJNNKzaWObKWCEclYHHSOc8tgonvrNslwy7cbH+yPJ9ZKAGjdT0dFEXY24jhuzniDIlO1k4KsumL683orq9rFqoi8eTcaY7lEIGuG6TFFm3E2tixoMdEKv4i9vNXDHvNEbeVo1wym6I/4WrYBeRjEANx5JEDEryY05G8u7i10iiwZsgy1jNvt4mezMC0mPUOEg0Cmz5sgKoM5q58kzJVUaGg+2sC6lgedkusGMNvYUZwDkgktZxTqkabi0bY6a/Q9igNvKOaNFqDDXqScgVlgyN50n1SHbavuHLd+1xAjsex7Dgf2kg+qcfQcw00psHp8tRTBXdgHkBTlG+FwOLNPU6EoFZXfPvGd+NlgTO0c3+40MGJ3CViY4hXLywLyJs/uABRmRrT+RXAmCLEazcwyO7t0LJyBqJHi0BFoP48O0wFyvEzifNLCBeHtSlP8aFYbZ8PjusDZUg17x5dGXpm15hC7IQA9Y7QLGw4xNmt0MnCFHyaWPnH4+yEc9XPRgPOjAYPkcfZrF93gk6aUjPBBQgh38/tmepBz5IoHxVXz5Lv2JSh+1maIoCjNMXO7izOzWpk+aG80RxWZYgaG2UOLbFbnda7wRI7O2wjmELwH57xU/HJMOEBJZHyrTsx1jYtB5ZzA/6lHBDNcoSTDqiTKkq2FbrDh8djoi4rX4k80jCgn+CK3aFBbQC+iA+Yet+s7vJVTvbXcVE5db991y9+SNTMoyBDQ8v4g0DNxSj1lqF5KXmvAFkrZnJe+h4V8g0paHlTi6mtxH6OvsyZ/+mNbhMYS++qVqQQDtw2LAyYu00BD1lkOigTRRm/6CES+pggQcwIxmjdrbv3oqv9CXwT40Ly9lqa32JeDLnNVUbkbjX3PyrayQNg0QInQ8BbAZuSkAWghZKbskxvbaBvWualLDRF05Jd1u8MGUTDZLgv3duZKyqzjrICMXhTTOI4/9PCIsqpOciuncKy/skREFDZsWObqr+qXsZiDjMBndvXrgBkgIwEIsDvkTMqpisBMGe6vXwiK2w+dh8ysWSDICQfmyk8HFHm8tOebB5fLICphLyV77Myv3A1jzAZXIopz2C6DUb+kNJelWkkyUk74lUl0JRjB7MbmU0lcEzVWtJmtR1YhOVoM7iWt5XId/KFFwllTM0Cd4ULblQKJKKkHTYHq7Ox5DzLsuEs0hzWwiMIQh4nHaIiXsUd0qasE8RReXCGF/Zgc7h5v6GkSPQK1glon7Tam/EQmvk8gGiucHLgCoiJJ17jG1QmHfcdFlSzviTklWWKNDscer25UDqssLl/j+2b+BObIZgtgpVRMoiYUaiDenkTUFdxDyiGMWpb9kBw5ZqpjqDN/787G/Wr9+EuTGfHbxsSSKCy/1q1KaLzVPPW77hJo002tKOquNOi32CAl02/djfRJeWXr5me9T4/GAhkpwtXy2KzBiEgAvKFQfte53tckDQW/vkMLaq5GpISIWDsc8s5eODB/DdsXJEhSxsOgpeMhoa62qGD3Ru+B9cpPo8hkrP0dkLY3YSa0wYjn9vSB12IhAki6IXZ6f771z5pEEkAWBHUJUnWs2kT5+fve+FLXib5WUX8qUPeBPrLNwFfu7B9IH6OOYSxGJxuuYLMk3W7IA4HUDfPWHx+zvpNNbesRNVO/2ykCEyhVfY5lJMpX+PZgkVIV99LguUegPRtYt4Qh9M7JDgYSk0dxj3M4PWgsbzYO+UJKrP+Xbpj59FalOuLBntMr3vjUzfHeTYcP2goEOgTJdU7eItW80AM8lDgqOtZFcJlYfA3U1UaMXZhG/HkVQEfqGjgGoj58yLKwUmK4Il7bNi9WKd+J/8H4Bwb95I/ayVikScHAH5sp0+v8tgSQ5Af4LOa4p0qUBqBVCrpaXnpC48qBfkP9h2KHNu3EM8DVJsfNYyMvkJrQtwTAEyW5Nf8b77s9oMd3T5y2fDVD1Ee80V/62nBsjwQGewYUpqRjUmEoZjmcI9GxqThjbohlO853JBqea6/xJhGuaLjy0pz9cxi9hYAJqAI2TOV/rLjYnKr8qdiIQotYZNyWsESxcbevc9SqF9AYYEoBgectbq7OI+MDngcBO7rSRIw24oNLIYors9YS3FgdQkNUlIo6MAJCWoekQcBM5WPZg5/8TdA9cmB7+0gc1mU5K8VlYDg5c/UuzzMZS59Oxz9WQLxoc8B6N+go5HRdPUdxedsB0HXMvO+xxusgrMtEbjk92KosQWXIIB+2ToFK9W96m056EJKmRd3ca9sdu4gqngRkrQyNYEXHLjvLoyFcaAv3VUL8VFpuDrOrL+DIECG2Q6LRcYrmawmRbevTc5bTgs5uTk1CcMXrB2zroTjQY07eoQIHrDwGz9//rJ5MZ+epLkPbED3at5BGEeSsRpyFdVt/zwlX2ioNHH9QoVkrUp+rgwyzcYWE2zSsvejINyTBEYHTbYMT5aBkTRZblb0kvGxI0w0cyp6r/cv3bYB3MX5KypLwp2w+w010VRhCtlnuBFWHQwD3opsfn+w0QvN6uyOBeBJZB0Ph2IxWOadUd6jm7wjqqN9JJ10H5BPrWUmANFHdCXu9dWz+1EP+2CYUuM/jxA9XZAfgG0LOtV+Q5f75V3zKJy+Ki6SNwY5i7fXZzIVyJhw9NSCgVSAWwrja44z7hWAKqUJZ7G83JAryiEvBAQdimsZJHgWjfDSGdb5R0yVuT9W36aYJULc+GAdG37Tf9TrqaXjH9YdXYuAa4iVpFoOs3+wh1/rT4FoIC76qRwHYLhitKj4LL9Lz4ETigCtxD45Ean2dnl5cpQod5aYXEPYaPM/L8zoEe3eaqOwHNYcOY2cpWJ+YWyXj5D/nEpM2PuBnUATZAfcK7pVFWZvhs0SlUL7xxlLUYImBfXU2fH2GZz47dnGmYj7T5T6Nt0A4wSRNTYpz4NFabD/3Lk/NLeuFQS5PiIq4fGFJ9e/739qE0wrWxEi24uvzkK7iDBcqOaoSF9NciRHPNSm8GDhLDR9UbI0FwULYV3v2B5DhEiof9Hg7yyiBXyG3KQNyegTxk/1h305XKCSZxJJPOoNae0JqkjVnNjGB6X9A1zC+Ym581hy3DWoZV3n1M+zMAr+gA/OlE0MWlHLU675HiBbN0+i8/vF0gcN/jmqyzmMZcM+byPBniR9vGU/LXCIqyJNSCmfx8wx/E3z1MlncWtjK4d/EpmBiiy7+HsDVT2/mJ3eM/lf07JquKBPaINYAdpMjKvzDv6qD/4jI8PBHnwdo71jos82u+eFxSb5TfHFlVPWM2UK4b2OXOIp+47GN0dZX7U5T4nV5LGpnLKsbkZNaR5VFP54jiyQWlTXXQ6grJ9k+SHNwTR50x8ZE08aykiFUIafBLl43mzwY+ExwjxAOHScHmDCfB76XvQcvAh5YkuwZ1bi7k3+QChJEjbldmvfihIkM5rtfin9ezskdtBynRJu9+M/q3tWvXkJ35EO7gmz6gLnJBPN3f9rOei5NGIruEaYQofi2gW7NTjZk7mqlo2Q+rJznHcEafPqWD9CN8cSnY5lWiUFI7h4T9aWEoCHXKpKbZ8JKZmk0+T6/r9kpl9PfqzQf96cW6bDlh0XCs9f4QaNP3wyuOEuqe5Cl0q/dm8Wld1T8lscKiW1lm+bu++4PmQ7S64eB8wPbx+JJOkFsdxcKu7VRWfPAHJy6VruTL0gWb19IgeXHU0jrCbLQiVqBoPyfqsJ6ghDiw92UI7fQOerdw85QwZZh0dhACgmzUsRphOqeU2cNzZFnL9XntdQbnRiyrPP2rrcHIRgxI/F8N4QtpRsqW0DaHND+lzYuUwKU8z4zYKDuqyzhqZqP3MaDENf4wYwPT2uAXBevppeI4H7sP1pN5y4MwNHHFM0I6xe17OIq9KMTC207NySoRe3OF0+jRW2k+kQr+Fc1D27ExEsjG1mXQyMnCK4RMybvG/uCzbe1+LQ0G9lsm8VbN4rMfpdCB2oNy+JS9V07B3xQLIzel+RjGWehL2WoDDW89kUT0T33gsl2fa4dI10t+l0p3knFcAJCE+WYMN31ehKd3sOMWoThmRhfZR55K0IYkfTYOQkDqx5Cnj2fspUgTFQVaSqSNzh8HO9d1luQ2VtMmOJaz2pgqfJt/foE+Cn8BuEcSv6vDlepuKn+DfTOde093lIEVCDlbhrn26ISkKPhpb7PLoVPwwFFRRRPahh8Kq+9wwwXc4wvp9ELufAel6srY7YaWXUhWOdkCWNZD5gtPXpWkoWKfFBCLdS9EbxU7YhGNjJPFrmJmXRZNAnz/RjwsApfETcwNXVI2tkGpiOXGJrvzjAEgvc/RT0iXI7Ne3+ZHZ23ZpShqg81FopAKvuSFFfFtmUl3B8ooS+Qs3qljQCpPMjeDca04jG1RPP/fhWdVPGdUFlc+Z9nh6UemZYGjJcWPgm5jLX+IolsthUnDqy89Xf+0I3qJ2kBHpk0CXUTEnWhPrbcJdAQdWs5vRlKqt2SotpJqPsmvEoIS56zysw4FnoKr0HWZarsl+aV5fk9sPlw8/wAJ4zs0Zz6noRvYOMV4fAqSQ2/I5yG+ibhBLlnzgPIJLzEw2btFU4kXgbEsPkBIW6UUM95TsbG/ad+agQrlr136gLFErYgxICnttFUlBgmul7vncUOaTWFNDLLrYFUQVQ6lyHiGTX/yi/vuSmfIo13ykg44XmB4IgaJO1/i3FQ6pOcLYC0GXWXGUhYmYcEfZiYDYuC0jgRlCrklUiSNcms99RBAGLBvGd9RrFKCnFw7ChE2sCDU0tn6Y7H9HkrXUBGLLpFoau81w9hoRtQElZZHPRGpY9aW5U2ijZKC8SBE7LN8xcOu2uDyLriEQH3/3IDWaVr02eVL2bjTf0rM0vl9eVpvJErEvvxPrGpCA0VYHnUXv4Bp7CqNKB16oHGKK3tVo9Zo5IKiRl9qXPHlr63Vt+l4Z1asp9MRGysOQrij1++MrRHrD2CVBSNgBKZgQ8o9VUzgPgqJEvm6l3Ib5B6heGHlh6bldhvLAehfk0QcgQmXC4SeTW8xQsmM6H7gTfoLXeZqT36xj5PcdWFhjYBpH4eR7U5ZnU62sZKIyMp44vfAgIDXOgJbUL68ZubzcRNORqkI8T6Llt/ihb5BPqqxapVjIMruQRbFsoAgPL0o++WbknDQJeJkNsF+6xhZzKh0CfcYjKJBxuD007I1gXWYameVuPa7frQsuo0zVq/XUUr9g5CcoK9QwOb5ke3nw69kKN9NxelzjOnyUpYUudXNzI9R/njQJgWArd5/BPKOuE4A64ZgBCwXR+Xil6zPbbWvtCZZN5XJIrE37RqoVFIITt/xkHiwukUI6SgKq8Z/R+T6e7HvDXIBfkqulBg9FVLVvnA3qStGZS4IxNUt2orJwTM9LEvptEISEdR6EhJPNAvYz0mTVokoewTVuPp7r3LkZs45qlA1wjPsltWt/obzH0EWGm5szpHERVZ6vpPRVKNzelxaDCLWNNGRpyzvHRqEVJpsEkTbZJZsF4Dg4AZ6jOf7nY0LieaYywlEyZc2XZmvJEYItny/PowQq6GBzt0C1JnnqgOY/AZA2z/viFyTDN+BlHY8pUEM1hvUzNumvnlW25WZAcTJBtkDtS1Yx/irArJoI+o+JcYITEJ3gsYYiWSyTEwaA64UjLo83LxXvx8SaB/osCqiPVHTblQCH/4/7Qo33o52ETz/iAAM0iQRua5VFQ8J6yNbaub+Qj5tI076RLhdtZEFxoYrJWBbT/dnnqFznEN1lTmXcQTDHAtGA7qgHJuNWu0qL5uGt3a7ZGk3y6N7ZCoHlNihGD+tlSKo72cpYVHHBFRg49yr6PhPUQFrhTkPN6H3V9bk7dv420itJ0LlzWN2JL53Sedlp0kYu42Kfu+vH8jsB3s1yULnGRrH2+Hcg04WwxT4gnWYFiKDopryQ3JPBq/t5cjKc6StrTjbxD1G5S4bSeDKL2NtDfqdM/iefSlEkzDdXLxCOGvgNa1zbJGBCPPJARgqVGefCtfXRQD7eSaPxwehhxgrcXE480O0OrIjJQyNffqgoSPoMafXFXsJibGADK619cf0L5L8P+geEBvKptbKIWbHGcL9zBZm5Rla0Uqi7uzJ8Jj/KHFVEyvaOM4NLQX+RhSgU070+MxV0dr3Ce8QpoIBekHqOneXBFM18qQQlhIZ40j6RMN9zz6O7d0SY4BpD70cqo4dir4DW3H0dc0IMQB199EFxg+stbh5XMQSh2QV8WgRR+pO9Vdq2K7AuxPJkORKf1gM1RS2nfIOFduHQ/UVUHjzVmEM5afsM+pUrmj15xc8m5/KxDYsiZUeDV+I6WYkbqAXmQ/KuwqE+geOlPOymatEZuD+HWLEp9zzQih0ajXxOjdLxN5hsZvtmJir07UmR4SNdT4zDhGrqFkYjQrX3LYAypV/2CMJ8NqHF70okK6KsE5ElpooU188znjJpFdNDSni1QwywpwDKj6Y0N+QCLvhssMD4mEQPxww8AM5QiwQXi023zr28XIgjJEgc3Gm8QKsZwCwEWdHBsnr5Wl0M8pl3AmIBBMjdsruffwCtxBGBb/Dcv/fKXFvGTTUiUOj93shtut0l6+7P64LYkbGK/4TxioYwupNFLx4jMIav94i68IHkjvvpnpMmCxhuKJt/nMPoK8G4mFCYp52HdVmIBlEvUU1rt6G3nNQ5CP11aAcziqQ4QOEXCSBkCmHh6EoMIFXkZ4kK3GM5Pe7mZtj8jDpnzPNQIU19HcuDibZUzrd9wEpzwBpgsbTe6HTj4U1OAFmUQxkQHVY/BFP9Hmc8EDFwGQl3PHB6Wgus3Y/HJJ3a8QGOzHj2V43YXE9S45ZD50/I5NDCakJIWGX14xNQrrYfpIvMmj/6Js9CdKako/30zGYeyf2S0wcNwa9zyCMTNNVQDF5H2+GbKM19wAIVXlzGxNBi5VfrMgix9UuiZj8SDVkVgQnTk1zdlGuQN0KRLQ+1ZozDfefRc24lYm0Hq39EPB96hBjte+jjucHJMOu5mmPp83T7IvuTYI6Lqd+UXI8JXs7L4O2oFjyI4G1T/6/tZOwTZ422e63ukK5/s2+dWWpEM/vh7MPvrRhILU9KHmEuEgs0ptIs4KNfq4cnJAiD8XSwXuLBCqLas+fC9QVT+nF2uY7St2TCMyrwccj9TnJrS9S99UhoRTXnQSTPmAz+t2FCYGm7CD2cziXfS4n9hTbJ3eobQsew74EjZyRKpRhacE5s11rQQyjfN1ajOpoBjHZ6S0euEKSiNqNtkVoyAHZvX9FWO1+NxGXi2oQYN7lj7QU+ZCatPj7NC3105Piz4U7krMpm/6Q3p+PHYuFjcFZcZeWP0Kuexsa6q7gDKIEV31JAKwtOoBRViXhjp5l0kdgh5p23+VYBg6zG/9z3SdFedz63Rktj+J/4Nq+bJiwhinJ8A7XAHbfqcrwuOzMmnX4jtuVosE4/56HlFXxQxsDUhEtPVN/y3fJDN70MYuNeeysXeegNR7QiO08G5s5y1rQCbgKAa6dNvKSPJnZ3z3kXdPf0A2Lkn0WP8lBfXxG5NU0Z+fXQfeBQKySz+uI1QBFckHCq6Zt/TIvQWuHwWLbD71YhWfQkL3u0mJNpW9Pkmgbb/pq/s38XF3RpO+jm4Yuf5txLA4jquy7t8rmZ0Dwob9u5cA82kytvQ2PCp5NU3W2XU60WuIwno/zq95VzGTUTtnq5DS3eNJflDuFYyWQmTTuYuHRg/ibQs1bE/Bz+++6Q0Z8wR1YAIy/1nWaXcE14SORgBQLis8M+OKbGZ2ANYi3jr0lJtohNez38OpunseBCJxCMZLPf9KJPku90xWXlr9ick7G87i47hB8vWN+hrldoHNmauRzQCvNbz0ZVLUK+MeAVcadEgbYsDCndg+Z1KawD+I+ojvznB6Y4NjlkFawnY8LC2oQZGzEK5Ub2HDieIVD+4JWcQehm9QZar1b+2l3xtjMjte+rttVHzUoPEysuc+ft0MM6Aye/9hhk7OjGx5wA7ntX+xjom1mOjQ2c3u6uzNtBDvdFw3RhcKfkt+qksJwPc/6xk1eQMDW5nZkRIb3A6HwiWW2jk6DqLwosnAtUFySY9tQ8d9aZKn+harpUmRY9tU8WQ/LoK75MUbDtKi1VsDCiKY3FrRa5fmBGkc267vF9RyfI3UVHR2pzrKaJKN1xa74LJTyj0ikpK02vGYpCazwH0Q5tlrZmeAu6NhzolwFFUPbtl5S9SVUK1vhR4E0GYwb4zDdQsctnk8MVBLAywh+elNVOuepxWDJh8zxvBiW5hfdf1/6nbycKE1wLoGBL1tOvnKzo9H8vWURfNXpfP2ArHE8COgIt218vo9bp+YhC+srDXbUh0v98kFxzHNdnvgYP1UDepAYBb2zD3+uCDSHdROtmh3AEcuqwac/jvrUoX5k2ANUBjxs3j/3AM++iPKEMxzqXF2NEDyc+U6BQ07HduyqehzNub/Y7cklp67sy+jcYlo8HIPCQ5DvzNUXxUCVb4cIo8yU3YRtUtka6FWhWXdpQxDPVf0EDmv4b1mEmA172Fd7262ZS40hYgj9zI+N6GI67T16zDecX3A31ymM2CwKNGtusBA7refRUqA7AyduUhpfBYKj+S+37FU3NeIMlol6FnaXQP9KfcSMLWkNhhdpFa9YXnc3pVXB78cHo5ssj0YLYMF3Bpvf3IG8raRbJ75113jxORhvVG9tCKDMv9kqpxsCZjD8G3188rvQjzjafSlOrLVJWPmNzNIAwCw6TXAt6ulswUnOIWx2/20VJQ5NyUNeUGeiilfGYcO7HCzDdDj2ccijN1FwT/1FAdfeNSv/+z0bz+y3BOnqE2RyYb/VZ8IWQGQkhHTLzt/cnInZKYfG+ORMhYCh0zhANSvzcXrZWhZYApE/XFjyBmhKiCObFUhjJs85yzJrXrMaeSIdQW5QLd+cKg2fJmbGIV8Lq2BrKvxg9/OIzjn40QlIjavAOlY8j+UuZxMvtMtkJSh9bhX1It5HzuD61JjTnmmwGtotPC3prE4qsiNzF6+Y/08u/jNm27v9T6enX2z/K6pA/nAY0mUpqGMsQ4SQ6w7857048dFGkz2sFxiuAVyy5kLoxLxKb9y+w2DoBYxR+/98wDga9a9TAWnOpo2PvYGtCRpUelthGDUU5cXvTaCrrmPCr9ffRMtkxNxfvSVhLXfGYvQpzdqKALLMOWPcHgnSQ8UeDOx2bqTHqg1rr1gmOE5hOHIN7tYupIiDpNjXScPC1swjoRUUc/DFDHUOXFNwl7qKvzT7Fv/l3TG/mbdlkguohpbwuTiGyXgts2rZQXkutYjZTgdCF4WM7R3DEuyPY76uiTiSRSBFFQRy7fqn7QGnasW9tdFhz1ZV/Mogw45LcIvG5Fq2Ze6fgO2UQ/s+kBStXmPGqYbRPENjsTbZZug46vVSt5IXnXJjQWYmwMueIzsgCeynYFjglMaVjaJNlgc9d97ZxSREdACdW1XwJhrei2JIx71HXF2PvXkMixJY/ZblO3qsESfZuUd/kG7UfUnD6kHzX8p01PdgDuXaNGJPUVfIpOKYit/c9+gnvGM6WnquVjNDi0VqsmDwdc3qd8W9EIofqsAVG2ftyh8f/MbrcQVyyBtyhjT/EfvmBA36fbJrghr5zkpc/H2d+O8bvpUd+FcXWqn56xpsd4OAl2HahtO5Z/NT1kumobeB7GoZT/HyI+eEFb4bZszcaBLJtucfIO1f/88nEI4TuQOl7H+fB/Ak2SCJPoaIW2P5moRqRb4cZVurVX7ClYqwW6DyDQSy3l3De3dQo9ejjr8FRQRjeTK3mI6CVvuYzD7UvuE5zoMv/LpTCkMjiupNRLmxT75eA17BXVIAG8vlws/6XtdhNeCSpsspfFlap3qkfzHGpsCBxNBSkoNYxMXH8kNm72LRqEqDhj7f55q+cjiVz0mWv+lOwYNIrgholoYrzEeN/WOkKWVYLQjrEgr5NhpMA4jcs8+Qvt+RIQEWCPmXvOVpcw5JH9yI+Xmokvpn8YL4QmGnAOfPi26PY+LpdvkqhLZNA4fpeo6qLRdQA8y+4lqe1773N6tYwCWeHSX6aLY2qcRjpbamgXjiDHhwRlcx46wjQ3NtffD6qqx9JtiXaz50/EHK3gkIPjPkJOUGDWgwufRl9LJ5VYWQHpWHYuTV8lbKxhnvnw2SAQIme2nCiG5BOnQ/t/pClf20KpwleQ0n0FaArsn/Ko0YnBZUZsU6VZNzuHt6VNyI3LG4q8OaM6ysYfccWCv4Vnuv2pmCGOK/K2zSThOfLJhs+pDPQLMxJPdvejYHbgozGUk6PT00xuQHTRC+xMUS35ZulfuWblnc6Cu6xHh1exDC1Qd6c7+oorq9gZHWuRokkUku8zlKweoNtu01942oA47h62nFakE6Pwqr1D2ASEQ18r+Ptj5lfcOc3bkQ/D9lwxeXFifAAzAaOYI1LZCdKAJUPffCDwf/I9iT0+3QYrpb8lser40CFePt/UeQeySAmKnNIfyDs6Y4FZxz8X48vXN2PufzRPSKBBdYieKjG53cqS+VD024S+MdLJTCNI1lQ/uS0QIjD/jvjJl5qhPHCRE0+iA979piiGo4a5gQNGWhb5tVSnOX+5PKDgP6OvRtWM3zQVu73dIH3fXMJqueCoaJajcMcCZR1Ckda8n2q/OAxagVZqCc11Nqp5HT5FZJWxj12ve1Wn3pTsqvV5T6r7M/zzUbX1KnZU44JR/JojRh7zSAGhYbu1/5tXhD4jxmPuEhb6pYjI/CixjKRdwr/rVSv1Irb0MsLCooX9UjrBNVQWnjn/C/6P329sl88jsNKYbjeL8wRP8AyL8LCS84HFmOjS3hPiwSnGuhK5zA4gRWnkG3TUgn9qW9s8EZB2+O+F3aTgOPqR1A7QotDLT0RwVXFcTul/VHMENcLc2ameOq6QZDtYglwxSt2ZC8hWPYzziydjylZ8knJ14KZR+R5nnU8KNBw+k9R97YBf/dhIcpPPv55IL01iJq5MueQasJLxaowPusuQWRWQkR+5JebJIi4UohiGfE0faKN5/X7C6K/wL97+vi36Hj4/4NB2nNzpdkd9j3uI7LtB+Z+ABQ9QnoyUU1x1Mma2X9oryhaS438s319TqGp4r0x2MCDhWw8ku8HS0HOCeBulWP8+3lUJvNuv/8mQoBBlzoV5QWw+rNvF753vn7DiaELA7lE37za5Do/6Q+aT44dKPI5Nw9tC0TPfoY/d9kxL+UiHGAZnq+AvTys88od65eeXLtJQ0Bt4ELDMLWgRAEu4odXK35cBqW46ycs/yYUbMfoL2DZfRXhA8fcLEmi/RlhJVIJv73ZlnbKGczJT6I/CStUpuxTJJEnkwtN69LYXq2MW4tskNNtY2ukpckwT161qyLJWMuUp2ujf23eVILI68QOTjalyZTJhwug/k2Susz3nyOZEne7hsF33pQTOzE2r88T8WtfZ08Y8bvUzcMql41EN4s6+7Q2ZZKHeQ6eGySXvAAABYTVAgAQUAADx4OnhtcG1ldGEgeG1sbnM6eD0nYWRvYmU6bnM6bWV0YS8nPgogICAgICAgIDxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogICAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgICAgICAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICAgICAgICA8ZGM6dGl0bGU+CiAgICAgICAgPHJkZjpBbHQ+CiAgICAgICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5Qcm9kdWN0IGltYWdlLXdvbWVuLURyZXNzLSA4MDAgeCAxMDQwIC0gMzwvcmRmOmxpPgogICAgICAgIDwvcmRmOkFsdD4KICAgICAgICA8L2RjOnRpdGxlPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOkF0dHJpYj0naHR0cDovL25zLmF0dHJpYnV0aW9uLmNvbS9hZHMvMS4wLyc+CiAgICAgICAgPEF0dHJpYjpBZHM+CiAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSdSZXNvdXJjZSc+CiAgICAgICAgPEF0dHJpYjpDcmVhdGVkPjIwMjQtMTAtMTA8L0F0dHJpYjpDcmVhdGVkPgogICAgICAgIDxBdHRyaWI6RXh0SWQ+ZDQ3OWFlZDMtYzBlNy00YTI1LWIwYTMtYjUzOGFhZmQwODZiPC9BdHRyaWI6RXh0SWQ+CiAgICAgICAgPEF0dHJpYjpGYklkPjUyNTI2NTkxNDE3OTU4MDwvQXR0cmliOkZiSWQ+CiAgICAgICAgPEF0dHJpYjpUb3VjaFR5cGU+MjwvQXR0cmliOlRvdWNoVHlwZT4KICAgICAgICA8L3JkZjpsaT4KICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgPC9BdHRyaWI6QWRzPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgICAgICAgPHBkZjpBdXRob3I+UG9vcm5pbWEgc2F0aHlhbmFyYXlhbmFuPC9wZGY6QXV0aG9yPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnhtcD0naHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyc+CiAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5DYW52YSAoUmVuZGVyZXIpPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgICAgICAgCiAgICAgICAgPC9yZGY6UkRGPgogICAgICAgIDwveDp4bXBtZXRhPgA=
2	QT-2026-00002	1	House of Amore	\N	test	2.000	200.00	6000.00	GST	18.00	1080.00	7280.00	Converted to Style	1	\N	test	test	Style	21	2026-04-28 06:38:36.876572+00	admin@zarierp.com	2026-04-28 06:35:27.698956+00	2026-04-28 06:38:36.876572+00	modern	data:image/webp;base64,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LmNvbS9hZHMvMS4wLyc+CiAgICAgICAgPEF0dHJpYjpBZHM+CiAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSdSZXNvdXJjZSc+CiAgICAgICAgPEF0dHJpYjpDcmVhdGVkPjIwMjQtMTAtMTA8L0F0dHJpYjpDcmVhdGVkPgogICAgICAgIDxBdHRyaWI6RXh0SWQ+ZDQ3OWFlZDMtYzBlNy00YTI1LWIwYTMtYjUzOGFhZmQwODZiPC9BdHRyaWI6RXh0SWQ+CiAgICAgICAgPEF0dHJpYjpGYklkPjUyNTI2NTkxNDE3OTU4MDwvQXR0cmliOkZiSWQ+CiAgICAgICAgPEF0dHJpYjpUb3VjaFR5cGU+MjwvQXR0cmliOlRvdWNoVHlwZT4KICAgICAgICA8L3JkZjpsaT4KICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgPC9BdHRyaWI6QWRzPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnBkZj0naHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyc+CiAgICAgICAgPHBkZjpBdXRob3I+UG9vcm5pbWEgc2F0aHlhbmFyYXlhbmFuPC9wZGY6QXV0aG9yPgogICAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgoKICAgICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogICAgICAgIHhtbG5zOnhtcD0naHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyc+CiAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5DYW52YSAoUmVuZGVyZXIpPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgICAgICAgCiAgICAgICAgPC9yZGY6UkRGPgogICAgICAgIDwveDp4bXBtZXRhPgA=
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.role_permissions (id, role_id, permission) FROM stdin;
1	1	dashboard
2	1	orders
3	1	accounts
4	1	quotation
5	1	shipping
6	1	masters:hsn
7	1	masters:materials
8	1	masters:fabric
9	1	masters:clients
10	1	masters:vendors
11	1	masters:style_categories
12	1	masters:swatch_categories
13	1	masters:swatches
14	1	masters:styles
15	1	masters:packaging_materials
16	1	user_management
17	1	masters:item_types
18	1	masters:shipping_vendors
19	1	swatch_orders
20	1	style_orders
21	1	artwork
22	1	stock:items
23	1	stock:ledger
24	1	stock:reservations
25	1	stock:adjustments
26	1	stock:purchase_orders
27	1	stock:purchase_receipts
28	1	accounts:dashboard
29	1	accounts:vendor_ledgers
30	1	accounts:invoices
31	1	accounts:payments
32	1	accounts:credit_debit_notes
33	1	accounts:other_expenses
34	1	settings
35	1	dashboard:view
36	1	masters:hsn:view
37	1	masters:hsn:add_edit
38	1	masters:hsn:delete
39	1	masters:hsn:download
40	1	masters:materials:view
41	1	masters:materials:add_edit
42	1	masters:materials:delete
43	1	masters:materials:download
44	1	masters:fabric:view
45	1	masters:fabric:add_edit
46	1	masters:fabric:delete
47	1	masters:fabric:download
48	1	masters:clients:view
49	1	masters:clients:add_edit
50	1	masters:clients:delete
51	1	masters:clients:download
52	1	masters:vendors:view
53	1	masters:vendors:add_edit
54	1	masters:vendors:delete
55	1	masters:vendors:download
56	1	masters:style_categories:view
57	1	masters:style_categories:add_edit
58	1	masters:style_categories:delete
59	1	masters:swatch_categories:view
60	1	masters:swatch_categories:add_edit
61	1	masters:swatch_categories:delete
62	1	masters:swatches:view
63	1	masters:swatches:add_edit
64	1	masters:swatches:delete
65	1	masters:swatches:download
66	1	masters:styles:view
67	1	masters:styles:add_edit
68	1	masters:styles:delete
69	1	masters:styles:download
70	1	masters:item_types:view
71	1	masters:item_types:add_edit
72	1	masters:item_types:delete
73	1	masters:packaging_materials:view
74	1	masters:packaging_materials:add_edit
75	1	masters:packaging_materials:delete
76	1	masters:shipping_vendors:view
77	1	masters:shipping_vendors:add_edit
78	1	masters:shipping_vendors:delete
79	1	swatch_orders:view
80	1	swatch_orders:add_edit
81	1	swatch_orders:delete
82	1	swatch_orders:download
83	1	style_orders:view
84	1	style_orders:add_edit
85	1	style_orders:delete
86	1	style_orders:download
87	1	artwork:view
88	1	artwork:add_edit
89	1	artwork:delete
90	1	artwork:download
91	1	quotation:view
92	1	quotation:add_edit
93	1	quotation:delete
94	1	quotation:download
95	1	stock:dashboard:view
96	1	stock:items:view
97	1	stock:items:add_edit
98	1	stock:items:download
99	1	stock:low_stock:view
100	1	stock:low_stock:download
101	1	stock:ledger:view
102	1	stock:ledger:download
103	1	stock:reservations:view
104	1	stock:adjustments:view
105	1	stock:adjustments:add_edit
106	1	stock:adjustments:delete
107	1	stock:purchase_orders:view
108	1	stock:purchase_orders:add_edit
109	1	stock:purchase_orders:delete
110	1	stock:purchase_orders:download
111	1	stock:purchase_receipts:view
112	1	stock:purchase_receipts:add_edit
113	1	stock:purchase_receipts:delete
114	1	logistics:shipments:view
115	1	logistics:shipments:add_edit
116	1	logistics:shipments:delete
117	1	logistics:shipments:download
118	1	logistics:packing_lists:view
119	1	logistics:packing_lists:add_edit
120	1	logistics:packing_lists:delete
121	1	logistics:packing_lists:download
122	1	accounts:dashboard:view
123	1	accounts:vendor_ledgers:view
124	1	accounts:vendor_ledgers:download
125	1	accounts:purchases:view
126	1	accounts:purchases:download
127	1	accounts:invoices:view
128	1	accounts:invoices:add_edit
129	1	accounts:invoices:delete
130	1	accounts:invoices:download
131	1	accounts:payments:view
132	1	accounts:payments:add_edit
133	1	accounts:payments:delete
134	1	accounts:payments:download
135	1	accounts:credit_debit_notes:view
136	1	accounts:credit_debit_notes:add_edit
137	1	accounts:credit_debit_notes:delete
138	1	accounts:credit_debit_notes:download
139	1	accounts:other_expenses:view
140	1	accounts:other_expenses:add_edit
141	1	accounts:other_expenses:delete
142	1	settings:profile:view
143	1	settings:profile:add_edit
144	1	settings:currency:view
145	1	settings:currency:add_edit
146	1	settings:currency:delete
147	1	settings:banks:view
148	1	settings:banks:add_edit
149	1	settings:banks:delete
150	1	settings:gst:view
151	1	settings:gst:add_edit
152	1	settings:activity_logs:view
153	1	settings:activity_logs:download
154	1	settings:warehouses:view
155	1	settings:warehouses:add_edit
156	1	settings:warehouses:delete
157	1	settings:templates:view
158	1	settings:templates:add_edit
159	1	settings:download_logs:view
160	1	settings:download_logs:download
161	1	user_management:view
162	1	user_management:add_edit
163	1	user_management:delete
164	1	style_orders:tab:basic_info:view
165	1	style_orders:tab:completion_tracking:view
166	1	style_orders:tab:references:view
167	1	style_orders:tab:products:view
168	1	style_orders:tab:artworks:view
169	1	style_orders:tab:toile:view
170	1	style_orders:tab:client_link:view
171	1	style_orders:tab:estimate:view
172	1	style_orders:tab:costing:view
173	1	style_orders:tab:cost_sheet:view
174	1	style_orders:tab:shipping:view
175	1	style_orders:tab:invoices:view
176	1	swatch_orders:tab:basic_info:view
177	1	swatch_orders:tab:completion_tracking:view
178	1	swatch_orders:tab:references:view
179	1	swatch_orders:tab:artworks:view
180	1	swatch_orders:tab:client_link:view
181	1	swatch_orders:tab:estimate:view
182	1	swatch_orders:tab:costing:view
183	1	swatch_orders:tab:cost_sheet:view
184	1	swatch_orders:tab:shipping:view
185	1	swatch_orders:tab:invoices:view
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.roles (id, name, description, is_system, created_at) FROM stdin;
1	admin	Full system access	t	2026-04-14 12:59:49.961343+00
2	user	Standard user access	t	2026-04-14 12:59:50.070194+00
\.


--
-- Data for Name: shipping_vendors; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.shipping_vendors (id, vendor_name, contact_person, phone_number, email_address, weight_rate_per_kg, minimum_charge, remarks, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.stock_adjustments (id, item_id, inventory_id, adjustment_type, adjustment_direction, adjustment_quantity, unit, average_price_at_adjustment, revenue_loss_amount, reference_type, reference_id, reason, remarks, adjusted_by, adjustment_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_ledger; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.stock_ledger (id, item_id, transaction_type, reference_number, reference_type, in_quantity, out_quantity, balance_quantity, remarks, created_by, created_at) FROM stdin;
1	2	wastage		manual_entry	0.000	0.500	119.500		admin@zarierp.com	2026-04-18 07:41:05.830239+00
2	13	style_reservation	7	Style	0.000	10.000	500.000	Reserved 10 for Style Order #7 (BOM row 1)	admin@zarierp.com	2026-04-19 12:41:42.794449+00
3	13	consumption	7	Style	0.000	8.000	492.000	Consumption from Style Order #7 (log #1)	admin@zarierp.com	2026-04-19 12:43:40.838953+00
4	13	consumption	7	Style	0.000	2.000	490.000	Consumption from Style Order #7 (log #2)	admin@zarierp.com	2026-04-19 12:43:49.475702+00
5	11	style_reservation	1	Style	0.000	10.000	80.000	Reserved 10 for Style Order #1 (BOM row 2)	admin@zarierp.com	2026-04-20 03:53:11.654614+00
6	14	style_reservation	1	Style	0.000	25.000	180.000	Reserved 25 for Style Order #1 (BOM row 3)	admin@zarierp.com	2026-04-20 03:53:25.742035+00
7	12	swatch_reservation	3	Swatch	0.000	12.000	250.000	Reserved 12 for Swatch Order #3 (BOM row 4)	admin@zarierp.com	2026-04-28 06:25:11.061862+00
8	12	consumption	3	Swatch	0.000	4.000	246.000	Consumption from Swatch Order #3 (log #3)	admin@zarierp.com	2026-04-28 06:29:44.313342+00
9	12	consumption	3	Swatch	0.000	8.000	238.000	Consumption from Swatch Order #3 (log #4)	admin@zarierp.com	2026-04-28 06:29:52.013432+00
10	11	adjustment_in	Manual Entry	manual_entry	90.000	0.000	170.000		admin@zarierp.com	2026-04-28 06:40:05.078185+00
11	2	wastage		manual_entry	0.000	10.000	109.500		admin@zarierp.com	2026-04-28 06:41:46.239858+00
12	3	adjustment_out	Manual Entry	manual_entry	0.000	80.000	5.000		admin@zarierp.com	2026-04-28 06:42:08.924658+00
13	3	adjustment_out	Manual Entry	manual_entry	0.000	5.000	0.000		admin@zarierp.com	2026-04-28 06:42:23.107807+00
\.


--
-- Data for Name: style_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.style_categories (id, category_name, is_active, is_deleted, created_by, created_at, updated_by, updated_at) FROM stdin;
3	Kurti	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
4	Dupatta	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
5	Blouse	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
6	Suit Set	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
7	Dress	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
8	Anarkali	t	f	admin	2026-04-18 07:17:58.980206+00	\N	\N
1	Saree	t	f	admin	2026-04-18 07:17:58.980206+00	admin@zarierp.com	2026-04-28 08:04:33.049+00
2	Lehenga	t	f	admin	2026-04-18 07:17:58.980206+00	admin@zarierp.com	2026-04-28 08:04:42.081+00
\.


--
-- Data for Name: style_order_artworks; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.style_order_artworks (id, artwork_code, style_order_id, style_order_product_id, style_order_product_name, artwork_name, unit_length, unit_width, unit_type, artwork_created, work_hours, hourly_rate, total_cost, outsource_vendor_id, outsource_vendor_name, outsource_payment_date, outsource_payment_amount, outsource_payment_mode, outsource_transaction_id, outsource_payment_status, feedback_status, files, ref_images, wip_images, final_images, is_deleted, created_by, created_at, updated_by, updated_at, toile_making_cost, toile_vendor_id, toile_vendor_name, toile_cost, toile_payment_date, toile_payment_mode, toile_payment_status, toile_transaction_id, toile_images, pattern_type, pattern_making_cost, pattern_doc, pattern_outhouse_doc, toile_payment_type, toile_payment_amount, toile_remarks, pattern_vendor_id, pattern_vendor_name, pattern_payment_type, pattern_payment_mode, pattern_payment_status, pattern_payment_amount, pattern_transaction_id, pattern_payment_date, pattern_remarks, videos) FROM stdin;
\.


--
-- Data for Name: style_order_products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.style_order_products (id, style_order_id, product_name, style_category_id, style_category_name, product_status, fabric_id, fabric_name, has_lining, lining_fabric_id, lining_fabric_name, unit_length, unit_width, unit_type, order_issue_date, delivery_date, target_hours, issued_to, department, ref_docs, ref_images, is_deleted, created_by, created_at, updated_by, updated_at, pattern_type, pattern_making_cost, pattern_doc, pattern_outhouse_doc, pattern_vendor_id, pattern_vendor_name, pattern_payment_type, pattern_payment_mode, pattern_payment_status, pattern_payment_amount, pattern_transaction_id, pattern_payment_date, pattern_remarks, videos) FROM stdin;
\.


--
-- Data for Name: style_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.style_orders (id, order_code, style_name, style_no, client_id, client_name, quantity, priority, order_status, season, colorway, sample_size, fabric_type, order_issue_date, delivery_date, target_hours, issued_to, department, description, internal_notes, client_instructions, is_chargeable, is_deleted, created_by, created_at, updated_by, updated_at, actual_start_date, actual_start_time, tentative_delivery_date, actual_completion_date, actual_completion_time, delay_reason, approval_date, revision_count, style_references, swatch_references, ref_docs, ref_images, estimate, delivery_address_id, is_inhouse, wip_images, final_images, wip_videos, final_videos) FROM stdin;
1	ZST-2601	Ivory Bridal Lehenga	STY-HAM-001	1	House of Amore	1	High	In Progress	Bridal 2026	Ivory & Gold	S	Banarasi Silk	2026-04-01	2026-04-30	80	Team A	Tailoring	Full bridal lehenga with heavy zari embroidery	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
2	ZST-2600	Champagne Saree	STY-VER-001	2	Vera Couture	2	Medium	Issued	Spring 2026	Champagne Beige	M	Georgette	2026-04-02	2026-04-25	40	Team B	Tailoring	Pre-draped saree with printed border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
3	ZST-2599	Black Chanderi Kurti	STY-NIL-001	3	Nila Threads	5	Low	Completed	Festive 2025	Midnight Black	M	Chanderi Silk	2026-03-15	2026-04-10	30	Team C	Tailoring	Embroidered chanderi kurti with contrast lining	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
4	ZST-2598	Party Anarkali	STY-MEE-001	4	Meera Bespoke	3	Urgent	Draft	Party 2026	Coral & Gold	S	Net Fabric	2026-04-08	2026-05-01	60	Team A	Tailoring	Heavy anarkali with sequin and net overlay	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
5	ZST-2597	Floral Organza Saree	STY-ELA-001	5	Elara Fashion	4	High	In Progress	Summer 2026	Pastel Lavender	L	Organza	2026-04-05	2026-04-28	50	Team B	Tailoring	Floral motif organza saree with zari border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
6	ZST-2596	Heritage Red Lehenga	STY-HAM-001	1	House of Amore	1	High	Completed	Bridal 2025	Ruby Red & Gold	S	Katan Silk	2026-02-01	2026-03-15	100	Team A	Tailoring	Red bridal lehenga with kadhwa zari work	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
7	ZST-2595	Cotton Suit Set	STY-SAN-001	6	Sanskriti Labels	10	Low	Completed	Summer 2026	Natural & Indigo	M	Cotton Muslin	2026-02-10	2026-03-10	20	Team C	Tailoring	Block print cotton suit set for festive retail	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
8	ZST-2594	Zari Blouse Collection	STY-RUH-001	7	Ruhani Couture	8	Medium	Completed	Festive 2025	Champagne Gold	S	Katan Silk	2026-01-20	2026-02-20	60	Team B	Tailoring	Luxe katan blouse with intricate zari motifs	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
9	ZST-2593	Mirror Embellished Dress	STY-MIR-001	8	Mira Atelier	3	Medium	In Progress	Resort 2026	Ivory & Mirror	M	Cotton Muslin	2026-03-20	2026-04-20	45	Team C	Tailoring	Contemporary dress with traditional mirror work	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
10	ZST-2592	Net Dupatta Collection	STY-ELA-001	5	Elara Fashion	12	Low	Completed	Spring 2026	Multi Color	Free	Net Fabric	2026-01-15	2026-02-15	15	Team B	Tailoring	Assorted net dupattas with lace border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
11	ZST-2591	Bridal Anarkali	STY-RUH-001	7	Ruhani Couture	2	Urgent	In Progress	Bridal 2026	Dusty Rose	M	Georgette	2026-04-10	2026-05-10	70	Team A	Tailoring	Full-length anarkali with embroidery and dupatta	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
12	ZST-2590	Festive Silk Kurti	STY-NIL-001	3	Nila Threads	6	Medium	Issued	Festive 2026	Saffron & Gold	M	Chanderi Silk	2026-04-03	2026-04-25	25	Team C	Tailoring	Festive kurti with mirror and zari border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
13	ZST-2589	Organza Dupatta Deluxe	STY-ELA-001	5	Elara Fashion	5	High	Issued	Bridal 2026	Pearl White	Free	Organza	2026-04-06	2026-04-30	20	Team B	Tailoring	Sheer organza dupatta with heavy embroidered border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
14	ZST-2588	Aria Handloom Saree	\N	9	Aria Handloom	15	Low	Draft	Summer 2026	Earthy Tones	Free	Cotton Muslin	2026-04-12	2026-05-05	18	Team C	Tailoring	Traditional handloom saree with natural dyes	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
15	ZST-2587	Mirror Work Kurti Batch	\N	10	Zoya Designs	20	Medium	Draft	Summer 2026	Multi	M	Cotton Muslin	2026-04-14	2026-05-10	35	Team A	Tailoring	Rajasthani mirror work kurti for retail batch	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
16	ZST-2586	Kochi Kasavu Saree	\N	9	Aria Handloom	8	Low	Completed	Heritage 2025	Gold & White	Free	Cotton Muslin	2025-12-01	2026-01-15	30	Team C	Tailoring	Traditional kasavu weave with golden border	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
17	ZST-2585	Party Lehenga Navy	STY-HAM-001	1	House of Amore	1	High	Completed	Party 2025	Navy & Silver	S	Net Fabric	2025-11-10	2025-12-10	65	Team A	Tailoring	Party lehenga with sequin embellishment	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
18	ZST-2584	Sequin Blouse Collection	STY-RUH-001	7	Ruhani Couture	6	Medium	Completed	Party 2025	Rose Gold	S	Georgette	2025-11-20	2025-12-20	40	Team B	Tailoring	Sequin-embellished georgette blouses for season	\N	\N	t	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
19	ZST-2583	Zoya Summer Set	\N	10	Zoya Designs	12	Medium	Cancelled	Summer 2025	Pastel Mint	M	Cotton Muslin	2025-10-01	2025-11-01	25	Team C	Tailoring	Summer cotton set cancelled due to design change	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
20	ZST-2582	Mira Silk Dress Pilot	STY-MIR-001	8	Mira Atelier	2	Low	Cancelled	Resort 2025	Oyster White	S	Chanderi Silk	2025-09-15	2025-10-30	50	Team A	Tailoring	Pilot run cancelled — client changed brief	\N	\N	f	f	admin	2026-04-18 07:17:59.212355+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
21	QST-2026-00004	gown	QST-2026-00004	1	House of Amore	1	Medium	Draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	test	\N	\N	f	f	admin@zarierp.com	2026-04-28 06:38:36.876572+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	[]	[]	[]	[]	[]	\N	f	[]	[]	[]	[]
\.


--
-- Data for Name: styles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.styles (id, client, style_no, invoice_no, description, attach_link, place_of_issue, vendor_po_no, shipping_date, style_category, reference_swatch_id, is_active, is_deleted, created_by, created_at, updated_by, updated_at, wip_media, final_media) FROM stdin;
1	House of Amore	STY-HAM-001	INV-2024-001	Bridal Banarasi Lehenga with Zari Work	\N	\N	\N	\N	Lehenga	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
2	Vera Couture	STY-VER-001	\N	Contemporary Georgette Saree with Printed Border	\N	\N	\N	\N	Saree	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
3	Nila Threads	STY-NIL-001	INV-2024-003	Designer Chanderi Kurti with Hand Embroidery	\N	\N	\N	\N	Kurti	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
4	Meera Bespoke	STY-MEE-001	\N	Party Wear Anarkali with Sequin Border	\N	\N	\N	\N	Anarkali	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
5	Elara Fashion	STY-ELA-001	INV-2024-005	Floral Organza Dupatta with Lace Border	\N	\N	\N	\N	Dupatta	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
6	Sanskriti Labels	STY-SAN-001	\N	Classic Cotton Suit Set with Block Print	\N	\N	\N	\N	Suit Set	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
7	Ruhani Couture	STY-RUH-001	INV-2024-007	Luxury Katan Silk Blouse with Zari Motifs	\N	\N	\N	\N	Blouse	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
8	Mira Atelier	STY-MIR-001	\N	Contemporary Silk Dress with Mirror Embellishment	\N	\N	\N	\N	Dress	\N	t	f	admin	2026-04-18 07:17:59.14152+00	\N	\N	[]	[]
\.


--
-- Data for Name: swatch_bom; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.swatch_bom (id, swatch_order_id, material_type, material_id, material_code, material_name, current_stock, avg_unit_price, unit_type, warehouse_location, required_qty, estimated_amount, created_by, created_at, updated_by, updated_at, consumed_qty, style_order_id, target_vendor_id, target_vendor_name) FROM stdin;
1	\N	material	5	MAT-005	Buttons – Premium	500	12	piece	Rack 3A	10	120.00	admin@zarierp.com	2026-04-19 12:41:42.730238+00	admin@zarierp.com	2026-04-19 12:43:49.402+00	10	7	\N	\N
2	\N	material	3	MAT-003	Beads – Premium	80	350	packet	Rack 2B	10	3500.00	admin@zarierp.com	2026-04-20 03:53:11.589038+00	\N	\N	0	1	\N	\N
3	\N	material	6	MAT-006	Lace Trim – Premium	180	85	meter	Rack 3B	25	2125.00	admin@zarierp.com	2026-04-20 03:53:25.6826+00	\N	\N	0	1	\N	\N
4	3	material	4	MAT-004	Embroidery Thread – Standard	250	65	spool	Rack 1B	12	780.00	admin@zarierp.com	2026-04-28 06:25:10.998105+00	admin@zarierp.com	2026-04-28 06:29:51.932+00	12	\N	\N	\N
\.


--
-- Data for Name: swatch_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.swatch_categories (id, name, is_active, created_at, is_deleted, created_by, updated_by, updated_at) FROM stdin;
1	test	t	2026-04-28 07:33:26.221641+00	f	admin@zarierp.com	admin@zarierp.com	2026-04-28 07:33:35.941+00
\.


--
-- Data for Name: swatch_orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.swatch_orders (id, order_code, swatch_name, client_id, client_name, is_chargeable, quantity, priority, order_status, style_references, swatch_references, fabric_id, fabric_name, has_lining, lining_fabric_id, lining_fabric_name, unit_length, unit_width, unit_type, order_issue_date, delivery_date, target_hours, issued_to, department, description, internal_notes, client_instructions, ref_docs, ref_images, actual_start_date, actual_start_time, tentative_delivery_date, actual_completion_date, actual_completion_time, delay_reason, approval_date, revision_count, is_deleted, created_by, created_at, updated_by, updated_at, estimate, delivery_address_id, is_inhouse, wip_images, final_images, wip_videos, final_videos) FROM stdin;
1	ZSW-0101	Ivory Banarasi Swatch	1	House of Amore	f	3	High	Completed	[]	[]	1	Banarasi Silk	f	\N	\N	45	36	cm	2026-01-05	2026-01-15	8	Priya	Sampling	Bridal collection swatch test	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
2	ZSW-0102	Champagne Georgette Swatch	2	Vera Couture	t	5	Medium	Completed	[]	[]	3	Georgette	f	\N	\N	50	44	cm	2026-01-10	2026-01-20	6	Ravi	Sampling	Season 2 georgette drape test	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
4	ZSW-0104	Net Overlay Swatch	4	Meera Bespoke	f	4	Urgent	In Progress	[]	[]	5	Net Fabric	t	\N	\N	60	44	cm	2026-02-01	2026-02-10	10	Priya	Sampling	Evening wear net test piece	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
5	ZSW-0105	Gold Katan Swatch	5	Elara Fashion	t	2	High	In Progress	[]	[]	6	Katan Silk	f	\N	\N	45	36	cm	2026-02-10	2026-02-20	8	Ravi	Sampling	Heritage katan for festive line	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
6	ZSW-0106	Chanderi Embroidery Swatch	6	Sanskriti Labels	f	3	Medium	Issued	[]	[]	2	Chanderi Silk	f	\N	\N	50	42	cm	2026-02-15	2026-02-28	6	Sneha	Sampling	Hand embroidery test on chanderi	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
7	ZSW-0107	Lavender Organza Swatch	7	Ruhani Couture	t	5	Medium	Issued	[]	[]	8	Organza	t	\N	\N	45	44	cm	2026-03-01	2026-03-15	5	Priya	Sampling	Sheer overlay with lace trim test	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
8	ZSW-0108	Cotton Block Print Swatch	9	Aria Handloom	f	6	Low	Draft	[]	[]	7	Cotton Muslin	f	\N	\N	55	36	cm	2026-03-10	2026-03-20	4	Ravi	Sampling	Block print repeat test for summer collection	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
9	ZSW-0109	Sequin Net Swatch	4	Meera Bespoke	t	3	High	In Progress	[]	[]	5	Net Fabric	f	\N	\N	40	44	cm	2026-03-15	2026-03-25	8	Sneha	Sampling	Party wear sequin scatter test	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
10	ZSW-0110	Mirror Work Cotton Swatch	10	Zoya Designs	f	4	Medium	Draft	[]	[]	7	Cotton Muslin	f	\N	\N	50	36	cm	2026-03-20	2026-03-30	6	Priya	Sampling	Rajasthani mirror work placement test	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
11	ZSW-0111	Ivory Georgette Swatch	1	House of Amore	f	2	High	Issued	[]	[]	3	Georgette	t	\N	\N	45	44	cm	2026-04-01	2026-04-10	6	Ravi	Sampling	Ivory drape with gold zari border	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
12	ZSW-0112	Embroidered Silk Swatch	8	Mira Atelier	t	3	Urgent	Issued	[]	[]	1	Banarasi Silk	f	\N	\N	50	36	cm	2026-04-05	2026-04-15	10	Sneha	Sampling	Heritage hand embroidery on banarasi	\N	\N	[]	[]	\N	\N	\N	\N	\N	\N	\N	0	f	admin	2026-04-18 07:17:59.172604+00	\N	\N	[]	\N	f	[]	[]	[]	[]
3	ZSW-0103	Black Crepe Swatch	3	Nila Threads	f	4	Urgent	Completed	[]	[]	4	Crepe	t			40	36	cm	2026-01-15	2026-01-25	4	Sneha	Sampling	Winter crepe series test			[]	[]								0	f	admin	2026-04-18 07:17:59.172604+00	admin@zarierp.com	2026-04-28 06:32:00.903+00	[]	\N	f	[]	[]	[]	[]
\.


--
-- Data for Name: swatches; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.swatches (id, swatch_code, swatch_name, fabric, color_name, hex_code, width, unit_type, finish_type, gsm, client, approval_status, remarks, is_active, is_deleted, created_by, created_at, updated_by, updated_at, swatch_category, location, swatch_date, length, hours, attachments, wip_media, final_media) FROM stdin;
1	SW-0001	test	Banarasi Silk – Premium	\N	\N	12	34	\N	\N	Aria Handloom	Pending	\N	t	f	admin@zarierp.com	2026-04-28 07:44:50.712617+00	admin@zarierp.com	2026-04-28 08:11:32.614+00	test	Inhouse	2026-04-22	12	23	[]	[{"url": "/uploads/swatches/SW-0001/wip/9246cb6e5e8594a1_ATT00001.jpeg", "name": "ATT00001.jpeg", "type": "image"}, {"url": "/uploads/swatches/SW-0001/wip/85e577917b2d4123_Chakra_diagnosis_and_root_cause_analysis.webp", "name": "Chakra diagnosis and root cause analysis.webp", "type": "image"}]	[]
2	SW-0002	GFDYHGjhdhjdfbfjdfh sdkjfhbdskjfsdkj fskj fhskdj fskdjfh dskjfhskjdfskjfgsjkdgfsjgfjsdgfsjdgfsjgfsjk	Georgette – Premium	\N	\N	23	34	\N	\N	Aria Handloom	Pending	\N	t	f	admin@zarierp.com	2026-04-28 08:13:11.500306+00	\N	\N	test	Client	2026-04-21	45	34	[]	[]	[]
\.


--
-- Data for Name: unit_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.unit_types (id, name, is_active, created_at) FROM stdin;
1	34	t	2026-04-28 08:10:58.971334+00
2	fdg gerg	t	2026-04-28 08:35:00.217215+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, email, hashed_password, role, is_active, created_at, invite_token, invite_token_expiry, phone_number, profile_photo) FROM stdin;
1	admin	admin@zarierp.com	$2b$10$Ans/U154fU7xLL2d1jBhtuUO1cR9ydI3eH7qS.wQGS2/txHxsTyMu	admin	t	2026-04-14 07:55:12.97405+00	\N	\N	\N	\N
2	Firoz	firoz@onerooftech.com	$2b$10$B3tpMSvumS/aAfxhKHE4ee0lxTFyrVEktzgKObk1fmt7RofMl60oy	admin	f	2026-04-28 07:35:37.553049+00	4d3dd4e1bdcf579eda1a7c22b949d27c73d19ce25eae8e5c602cfef0d8142fa5	2026-05-05 07:35:37.409+00	\N	\N
\.


--
-- Data for Name: vendor_invoice_ledger; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.vendor_invoice_ledger (id, vendor_id, vendor_name, purchase_receipt_id, pr_number, vendor_invoice_number, vendor_invoice_date, vendor_invoice_amount, entry_type, status, notes, created_by, created_at, updated_at, paid_amount, linked_po_number) FROM stdin;
\.


--
-- Data for Name: vendor_ledger_charges; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.vendor_ledger_charges (id, vendor_id, vendor_name, charge_date, description, amount, notes, order_type, style_order_id, style_order_code, swatch_order_id, swatch_order_code, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: vendor_payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.vendor_payments (id, vendor_id, vendor_name, payment_date, amount, payment_mode, reference_no, notes, order_type, style_order_id, style_order_code, swatch_order_id, swatch_order_code, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.vendors (id, vendor_code, brand_name, contact_name, email, alt_email, contact_no, alt_contact_no, has_gst, gst_no, bank_name, account_no, ifsc_code, address1, address2, country, state, city, pincode, is_active, is_deleted, created_by, created_at, updated_by, updated_at, bank_accounts, payment_attachments, addresses) FROM stdin;
1	VND-001	Silk Route Textiles	Ramesh Kumar	ramesh@silkroute.com	\N	9876543210	\N	t	27AABCS1234A1Z5	\N	\N	\N	Shop 12, Surat Textile Market	\N	India	Gujarat	Surat	395002	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
2	VND-002	Golden Thread Co.	Priya Mehta	priya@goldenthread.in	\N	9123456780	\N	t	09AABCG5678B2Z3	\N	\N	\N	Plot 44, Embroidery Zone	\N	India	Delhi	Delhi	110006	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
3	VND-003	Banaras Silk House	Suresh Gupta	suresh@banarassilk.com	\N	9988776655	\N	t	09AABCB9012C3Z1	\N	\N	\N	Chowk Market, Varanasi	\N	India	Uttar Pradesh	Varanasi	221001	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
4	VND-004	Jaipur Print Works	Anita Sharma	anita@jaipurprint.in	\N	9870001122	\N	f	\N	\N	\N	\N	MI Road, Block 7	\N	India	Rajasthan	Jaipur	302001	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
5	VND-005	Mumbai Zari Works	Deepak Patel	deepak@mumbaizari.com	\N	9811223344	\N	t	27AABCM3456D4Z2	\N	\N	\N	Dharavi Textile Hub	\N	India	Maharashtra	Mumbai	400017	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
6	VND-006	Chennai Lace House	Kavitha Nair	kavitha@chennaince.in	\N	9944556677	\N	f	\N	\N	\N	\N	T. Nagar, Row 3	\N	India	Tamil Nadu	Chennai	600017	t	f	admin	2026-04-18 07:17:59.010025+00	\N	\N	\N	\N	\N
7	VEN0007	Tes Verer ERTskv kds	dfgreg erg trg			+91 4564993939	+91	f		\N	\N	\N			Algeria				t	f	admin@zarierp.com	2026-04-28 08:12:27.734376+00	admin@zarierp.com	2026-04-28 08:20:44.605+00	[{"bankName": "wet43ty", "ifscCode": "43t25y", "accountNo": "4t$Y$%"}]	[]	[{"id": "6m8rpiby", "city": "Mumbai", "name": "ER%$Y$%Y", "type": "Office", "state": "Maharashtra", "country": "India", "pincode": "400080", "address1": "", "address2": "", "contactNo": "ertt44", "isBillingDefault": true}]
\.


--
-- Data for Name: warehouse_locations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.warehouse_locations (id, name, code, address_line1, address_line2, city, state, pincode, country, contact_name, contact_phone, contact_email, is_active, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: width_unit_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.width_unit_types (id, name, is_active, created_at) FROM stdin;
1	CM	t	2026-04-28 07:19:17.044378+00
\.


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE SET; Schema: _system; Owner: neondb_owner
--

SELECT pg_catalog.setval('_system.replit_database_migrations_v1_id_seq', 22, true);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 122, true);


--
-- Name: artisan_timesheets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.artisan_timesheets_id_seq', 1, true);


--
-- Name: artworks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.artworks_id_seq', 13, true);


--
-- Name: bank_accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.bank_accounts_id_seq', 1, true);


--
-- Name: bom_change_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.bom_change_log_id_seq', 1, false);


--
-- Name: client_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.client_feedback_id_seq', 1, false);


--
-- Name: client_invoice_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.client_invoice_ledger_id_seq', 1, true);


--
-- Name: client_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.client_links_id_seq', 2, true);


--
-- Name: client_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.client_messages_id_seq', 1, false);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.clients_id_seq', 12, true);


--
-- Name: company_gst_settings_gst_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.company_gst_settings_gst_settings_id_seq', 1, true);


--
-- Name: consumption_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.consumption_log_id_seq', 4, true);


--
-- Name: costing_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.costing_payments_id_seq', 2, true);


--
-- Name: credit_debit_notes_note_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.credit_debit_notes_note_id_seq', 1, false);


--
-- Name: custom_charges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.custom_charges_id_seq', 1, false);


--
-- Name: delivery_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.delivery_addresses_id_seq', 1, false);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.departments_id_seq', 1, true);


--
-- Name: download_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.download_logs_id_seq', 3, true);


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.exchange_rates_id_seq', 4, true);


--
-- Name: fabric_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.fabric_types_id_seq', 1, true);


--
-- Name: fabrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.fabrics_id_seq', 9, true);


--
-- Name: hsn_master_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.hsn_master_id_seq', 3, true);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.inventory_items_id_seq', 35, true);


--
-- Name: inventory_stock_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.inventory_stock_logs_id_seq', 6, true);


--
-- Name: invoice_payments_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoice_payments_payment_id_seq', 1, true);


--
-- Name: invoice_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoice_templates_id_seq', 3, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.invoices_id_seq', 1, true);


--
-- Name: item_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.item_types_id_seq', 2, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.items_id_seq', 1, false);


--
-- Name: material_reservations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.material_reservations_id_seq', 4, true);


--
-- Name: materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.materials_id_seq', 8, true);


--
-- Name: order_shipping_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.order_shipping_details_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: other_expenses_expense_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.other_expenses_expense_id_seq', 1, false);


--
-- Name: outsource_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.outsource_jobs_id_seq', 1, true);


--
-- Name: packaging_materials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.packaging_materials_id_seq', 1, true);


--
-- Name: packing_list_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.packing_list_items_id_seq', 1, false);


--
-- Name: packing_lists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.packing_lists_id_seq', 1, false);


--
-- Name: packing_package_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.packing_package_items_id_seq', 1, false);


--
-- Name: packing_packages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.packing_packages_id_seq', 1, false);


--
-- Name: pr_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pr_payments_id_seq', 1, false);


--
-- Name: purchase_order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.purchase_order_items_id_seq', 1, false);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.purchase_orders_id_seq', 1, true);


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.purchase_receipt_items_id_seq', 1, false);


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.purchase_receipts_id_seq', 2, true);


--
-- Name: quotation_custom_charges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quotation_custom_charges_id_seq', 24, true);


--
-- Name: quotation_designs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quotation_designs_id_seq', 8, true);


--
-- Name: quotation_feedback_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quotation_feedback_logs_id_seq', 1, false);


--
-- Name: quotation_number_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quotation_number_seq', 4, true);


--
-- Name: quotations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.quotations_id_seq', 3, true);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.role_permissions_id_seq', 185, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.roles_id_seq', 2, true);


--
-- Name: shipping_vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.shipping_vendors_id_seq', 1, false);


--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.stock_adjustments_id_seq', 1, false);


--
-- Name: stock_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.stock_ledger_id_seq', 13, true);


--
-- Name: style_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.style_categories_id_seq', 8, true);


--
-- Name: style_order_artworks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.style_order_artworks_id_seq', 1, false);


--
-- Name: style_order_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.style_order_products_id_seq', 1, false);


--
-- Name: style_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.style_orders_id_seq', 21, true);


--
-- Name: styles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.styles_id_seq', 8, true);


--
-- Name: swatch_bom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.swatch_bom_id_seq', 4, true);


--
-- Name: swatch_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.swatch_categories_id_seq', 1, true);


--
-- Name: swatch_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.swatch_orders_id_seq', 12, true);


--
-- Name: swatches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.swatches_id_seq', 2, true);


--
-- Name: unit_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.unit_types_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: vendor_invoice_ledger_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.vendor_invoice_ledger_id_seq', 1, false);


--
-- Name: vendor_ledger_charges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.vendor_ledger_charges_id_seq', 1, false);


--
-- Name: vendor_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.vendor_payments_id_seq', 1, false);


--
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.vendors_id_seq', 7, true);


--
-- Name: warehouse_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.warehouse_locations_id_seq', 1, false);


--
-- Name: width_unit_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.width_unit_types_id_seq', 1, true);


--
-- Name: replit_database_migrations_v1 replit_database_migrations_v1_pkey; Type: CONSTRAINT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1
    ADD CONSTRAINT replit_database_migrations_v1_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: artisan_timesheets artisan_timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.artisan_timesheets
    ADD CONSTRAINT artisan_timesheets_pkey PRIMARY KEY (id);


--
-- Name: artworks artworks_artwork_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_artwork_code_unique UNIQUE (artwork_code);


--
-- Name: artworks artworks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bom_change_log bom_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bom_change_log
    ADD CONSTRAINT bom_change_log_pkey PRIMARY KEY (id);


--
-- Name: client_feedback client_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_feedback
    ADD CONSTRAINT client_feedback_pkey PRIMARY KEY (id);


--
-- Name: client_invoice_ledger client_invoice_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_invoice_ledger
    ADD CONSTRAINT client_invoice_ledger_pkey PRIMARY KEY (id);


--
-- Name: client_links client_links_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_links
    ADD CONSTRAINT client_links_pkey PRIMARY KEY (id);


--
-- Name: client_links client_links_token_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_links
    ADD CONSTRAINT client_links_token_unique UNIQUE (token);


--
-- Name: client_messages client_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_messages
    ADD CONSTRAINT client_messages_pkey PRIMARY KEY (id);


--
-- Name: clients clients_client_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_client_code_unique UNIQUE (client_code);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_gst_settings company_gst_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.company_gst_settings
    ADD CONSTRAINT company_gst_settings_pkey PRIMARY KEY (gst_settings_id);


--
-- Name: consumption_log consumption_log_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consumption_log
    ADD CONSTRAINT consumption_log_pkey PRIMARY KEY (id);


--
-- Name: costing_payments costing_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.costing_payments
    ADD CONSTRAINT costing_payments_pkey PRIMARY KEY (id);


--
-- Name: credit_debit_notes credit_debit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_note_number_key UNIQUE (note_number);


--
-- Name: credit_debit_notes credit_debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_pkey PRIMARY KEY (note_id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (code);


--
-- Name: custom_charges custom_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.custom_charges
    ADD CONSTRAINT custom_charges_pkey PRIMARY KEY (id);


--
-- Name: delivery_addresses delivery_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.delivery_addresses
    ADD CONSTRAINT delivery_addresses_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_unique UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: download_logs download_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.download_logs
    ADD CONSTRAINT download_logs_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: fabric_types fabric_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabric_types
    ADD CONSTRAINT fabric_types_name_unique UNIQUE (name);


--
-- Name: fabric_types fabric_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabric_types
    ADD CONSTRAINT fabric_types_pkey PRIMARY KEY (id);


--
-- Name: fabrics fabrics_fabric_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabrics
    ADD CONSTRAINT fabrics_fabric_code_unique UNIQUE (fabric_code);


--
-- Name: fabrics fabrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fabrics
    ADD CONSTRAINT fabrics_pkey PRIMARY KEY (id);


--
-- Name: hsn_master hsn_master_hsn_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hsn_master
    ADD CONSTRAINT hsn_master_hsn_code_unique UNIQUE (hsn_code);


--
-- Name: hsn_master hsn_master_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hsn_master
    ADD CONSTRAINT hsn_master_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_source_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_source_unique UNIQUE (source_type, source_id);


--
-- Name: inventory_stock_logs inventory_stock_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_stock_logs
    ADD CONSTRAINT inventory_stock_logs_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (payment_id);


--
-- Name: invoice_templates invoice_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_templates
    ADD CONSTRAINT invoice_templates_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_no_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_unique UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: item_types item_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_name_unique UNIQUE (name);


--
-- Name: item_types item_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.item_types
    ADD CONSTRAINT item_types_pkey PRIMARY KEY (id);


--
-- Name: items items_item_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_item_code_key UNIQUE (item_code);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: material_reservations material_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.material_reservations
    ADD CONSTRAINT material_reservations_pkey PRIMARY KEY (id);


--
-- Name: materials materials_material_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_material_code_unique UNIQUE (material_code);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: order_shipping_details order_shipping_details_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_shipping_details
    ADD CONSTRAINT order_shipping_details_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_id_unique UNIQUE (order_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: other_expenses other_expenses_expense_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_expenses
    ADD CONSTRAINT other_expenses_expense_number_key UNIQUE (expense_number);


--
-- Name: other_expenses other_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.other_expenses
    ADD CONSTRAINT other_expenses_pkey PRIMARY KEY (expense_id);


--
-- Name: outsource_jobs outsource_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.outsource_jobs
    ADD CONSTRAINT outsource_jobs_pkey PRIMARY KEY (id);


--
-- Name: packaging_materials packaging_materials_item_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_materials
    ADD CONSTRAINT packaging_materials_item_code_unique UNIQUE (item_code);


--
-- Name: packaging_materials packaging_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_materials
    ADD CONSTRAINT packaging_materials_pkey PRIMARY KEY (id);


--
-- Name: packing_list_items packing_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_list_items
    ADD CONSTRAINT packing_list_items_pkey PRIMARY KEY (id);


--
-- Name: packing_lists packing_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists
    ADD CONSTRAINT packing_lists_pkey PRIMARY KEY (id);


--
-- Name: packing_lists packing_lists_pl_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists
    ADD CONSTRAINT packing_lists_pl_number_key UNIQUE (pl_number);


--
-- Name: packing_package_items packing_package_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_package_items
    ADD CONSTRAINT packing_package_items_pkey PRIMARY KEY (id);


--
-- Name: packing_packages packing_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_packages
    ADD CONSTRAINT packing_packages_pkey PRIMARY KEY (id);


--
-- Name: pr_payments pr_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pr_payments
    ADD CONSTRAINT pr_payments_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_unique UNIQUE (po_number);


--
-- Name: purchase_receipt_items purchase_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pr_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pr_number_unique UNIQUE (pr_number);


--
-- Name: quotation_custom_charges quotation_custom_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_custom_charges
    ADD CONSTRAINT quotation_custom_charges_pkey PRIMARY KEY (id);


--
-- Name: quotation_designs quotation_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_designs
    ADD CONSTRAINT quotation_designs_pkey PRIMARY KEY (id);


--
-- Name: quotation_feedback_logs quotation_feedback_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_feedback_logs
    ADD CONSTRAINT quotation_feedback_logs_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: shipping_vendors shipping_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.shipping_vendors
    ADD CONSTRAINT shipping_vendors_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: style_categories style_categories_category_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_categories
    ADD CONSTRAINT style_categories_category_name_unique UNIQUE (category_name);


--
-- Name: style_categories style_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_categories
    ADD CONSTRAINT style_categories_pkey PRIMARY KEY (id);


--
-- Name: style_order_artworks style_order_artworks_artwork_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_order_artworks
    ADD CONSTRAINT style_order_artworks_artwork_code_unique UNIQUE (artwork_code);


--
-- Name: style_order_artworks style_order_artworks_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_order_artworks
    ADD CONSTRAINT style_order_artworks_pkey PRIMARY KEY (id);


--
-- Name: style_order_products style_order_products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_order_products
    ADD CONSTRAINT style_order_products_pkey PRIMARY KEY (id);


--
-- Name: style_orders style_orders_order_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_orders
    ADD CONSTRAINT style_orders_order_code_unique UNIQUE (order_code);


--
-- Name: style_orders style_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_orders
    ADD CONSTRAINT style_orders_pkey PRIMARY KEY (id);


--
-- Name: styles styles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.styles
    ADD CONSTRAINT styles_pkey PRIMARY KEY (id);


--
-- Name: swatch_bom swatch_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_bom
    ADD CONSTRAINT swatch_bom_pkey PRIMARY KEY (id);


--
-- Name: swatch_categories swatch_categories_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_categories
    ADD CONSTRAINT swatch_categories_name_unique UNIQUE (name);


--
-- Name: swatch_categories swatch_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_categories
    ADD CONSTRAINT swatch_categories_pkey PRIMARY KEY (id);


--
-- Name: swatch_orders swatch_orders_order_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_orders
    ADD CONSTRAINT swatch_orders_order_code_unique UNIQUE (order_code);


--
-- Name: swatch_orders swatch_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_orders
    ADD CONSTRAINT swatch_orders_pkey PRIMARY KEY (id);


--
-- Name: swatches swatches_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatches
    ADD CONSTRAINT swatches_pkey PRIMARY KEY (id);


--
-- Name: swatches swatches_swatch_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatches
    ADD CONSTRAINT swatches_swatch_code_unique UNIQUE (swatch_code);


--
-- Name: unit_types unit_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_name_unique UNIQUE (name);


--
-- Name: unit_types unit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_invoice_ledger vendor_invoice_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_invoice_ledger
    ADD CONSTRAINT vendor_invoice_ledger_pkey PRIMARY KEY (id);


--
-- Name: vendor_ledger_charges vendor_ledger_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_ledger_charges
    ADD CONSTRAINT vendor_ledger_charges_pkey PRIMARY KEY (id);


--
-- Name: vendor_payments vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_vendor_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_vendor_code_unique UNIQUE (vendor_code);


--
-- Name: warehouse_locations warehouse_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.warehouse_locations
    ADD CONSTRAINT warehouse_locations_pkey PRIMARY KEY (id);


--
-- Name: width_unit_types width_unit_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.width_unit_types
    ADD CONSTRAINT width_unit_types_name_unique UNIQUE (name);


--
-- Name: width_unit_types width_unit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.width_unit_types
    ADD CONSTRAINT width_unit_types_pkey PRIMARY KEY (id);


--
-- Name: idx_replit_database_migrations_v1_build_id; Type: INDEX; Schema: _system; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_replit_database_migrations_v1_build_id ON _system.replit_database_migrations_v1 USING btree (build_id);


--
-- Name: idx_cdn_invoice; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cdn_invoice ON public.credit_debit_notes USING btree (invoice_id);


--
-- Name: idx_cdn_party; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cdn_party ON public.credit_debit_notes USING btree (party_id);


--
-- Name: idx_cdn_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cdn_status ON public.credit_debit_notes USING btree (status);


--
-- Name: idx_cdn_type; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cdn_type ON public.credit_debit_notes USING btree (note_type);


--
-- Name: idx_client_invoice_ledger_client; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_client_invoice_ledger_client ON public.client_invoice_ledger USING btree (client_id);


--
-- Name: idx_client_invoice_ledger_invoice; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_client_invoice_ledger_invoice ON public.client_invoice_ledger USING btree (invoice_id);


--
-- Name: idx_download_logs_downloaded_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_download_logs_downloaded_at ON public.download_logs USING btree (downloaded_at);


--
-- Name: idx_download_logs_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_download_logs_user_id ON public.download_logs USING btree (user_id);


--
-- Name: idx_invoice_payments_invoice; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments USING btree (invoice_id);


--
-- Name: idx_invoice_payments_party; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_invoice_payments_party ON public.invoice_payments USING btree (party_id);


--
-- Name: idx_vendor_invoice_ledger_pr; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_vendor_invoice_ledger_pr ON public.vendor_invoice_ledger USING btree (purchase_receipt_id);


--
-- Name: idx_vendor_invoice_ledger_vendor; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_vendor_invoice_ledger_vendor ON public.vendor_invoice_ledger USING btree (vendor_id);


--
-- Name: credit_debit_notes credit_debit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: delivery_addresses delivery_addresses_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.delivery_addresses
    ADD CONSTRAINT delivery_addresses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: download_logs download_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.download_logs
    ADD CONSTRAINT download_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoice_payments invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: order_shipping_details order_shipping_details_shipping_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_shipping_details
    ADD CONSTRAINT order_shipping_details_shipping_vendor_id_fkey FOREIGN KEY (shipping_vendor_id) REFERENCES public.shipping_vendors(id);


--
-- Name: packing_list_items packing_list_items_packing_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_list_items
    ADD CONSTRAINT packing_list_items_packing_list_id_fkey FOREIGN KEY (packing_list_id) REFERENCES public.packing_lists(id) ON DELETE CASCADE;


--
-- Name: packing_lists packing_lists_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists
    ADD CONSTRAINT packing_lists_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: packing_lists packing_lists_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists
    ADD CONSTRAINT packing_lists_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.delivery_addresses(id);


--
-- Name: packing_lists packing_lists_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_lists
    ADD CONSTRAINT packing_lists_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.order_shipping_details(id);


--
-- Name: packing_package_items packing_package_items_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_package_items
    ADD CONSTRAINT packing_package_items_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packing_packages(id) ON DELETE CASCADE;


--
-- Name: packing_packages packing_packages_packing_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packing_packages
    ADD CONSTRAINT packing_packages_packing_list_id_fkey FOREIGN KEY (packing_list_id) REFERENCES public.packing_lists(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_po_item_id_fkey FOREIGN KEY (po_item_id) REFERENCES public.purchase_order_items(id);


--
-- Name: quotation_custom_charges quotation_custom_charges_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_custom_charges
    ADD CONSTRAINT quotation_custom_charges_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_designs quotation_designs_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_designs
    ADD CONSTRAINT quotation_designs_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_feedback_logs quotation_feedback_logs_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotation_feedback_logs
    ADD CONSTRAINT quotation_feedback_logs_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_parent_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_parent_quotation_id_fkey FOREIGN KEY (parent_quotation_id) REFERENCES public.quotations(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: style_orders style_orders_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.style_orders
    ADD CONSTRAINT style_orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.delivery_addresses(id);


--
-- Name: swatch_orders swatch_orders_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.swatch_orders
    ADD CONSTRAINT swatch_orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.delivery_addresses(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict EmvhKPwwW2gq9a5HGXtlXnP1to2zNaZkanjfWLkz7NdTeSGW5ZS6WlKHIZIc5ed

