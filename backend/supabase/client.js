function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isSupabaseConfigured() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return Boolean(url && serviceRoleKey);
}

function getBaseHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse(response, fallbackMessage) {
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    const error = new Error(data?.message || fallbackMessage);
    error.details = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

function requireSupabaseConfig() {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return { url, serviceRoleKey };
}

async function supabaseGet(table, query, fallbackMessage) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: getBaseHeaders(serviceRoleKey),
  });

  return parseResponse(response, fallbackMessage);
}

async function supabaseInsert(table, payload, fallbackMessage, { onConflict } = {}) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const query = onConflict ? `?on_conflict=${onConflict}` : "";
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      ...getBaseHeaders(serviceRoleKey),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response, fallbackMessage);
  return Array.isArray(data) ? data[0] || null : data;
}

async function supabaseInsertMany(table, payload, fallbackMessage) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...getBaseHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response, fallbackMessage);
  return Array.isArray(data) ? data : [];
}

async function supabasePatch(table, filterQuery, payload, fallbackMessage) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${filterQuery}`, {
    method: "PATCH",
    headers: {
      ...getBaseHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseResponse(response, fallbackMessage);
  return Array.isArray(data) ? data[0] || null : data;
}

async function supabaseDelete(table, filterQuery, fallbackMessage) {
  const { url, serviceRoleKey } = requireSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${filterQuery}`, {
    method: "DELETE",
    headers: {
      ...getBaseHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
  });

  const data = await parseResponse(response, fallbackMessage);
  return Array.isArray(data) ? data[0] || null : data;
}

module.exports = {
  getSupabaseConfig,
  isSupabaseConfigured,
  requireSupabaseConfig,
  supabaseDelete,
  supabaseGet,
  supabaseInsert,
  supabaseInsertMany,
  supabasePatch,
};
