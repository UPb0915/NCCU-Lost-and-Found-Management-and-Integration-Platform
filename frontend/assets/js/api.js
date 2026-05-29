const API_BASE_URL = "http://127.0.0.1:5000/api";

async function parseJsonResponse(response, fallbackMessage) {
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    return {
      success: false,
      message: data.message || fallbackMessage,
    };
  }

  return data;
}

async function apiGet(path) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    return parseJsonResponse(response, "API 讀取失敗");
  } catch (error) {
    return {
      success: false,
      message: "API 讀取失敗",
    };
  }
}

async function apiPostJson(path, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response, "API 新增失敗");
  } catch (error) {
    return {
      success: false,
      message: "API 新增失敗",
    };
  }
}

async function apiPostForm(path, formData) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
    });

    return parseJsonResponse(response, "API 上傳失敗");
  } catch (error) {
    return {
      success: false,
      message: "API 上傳失敗",
    };
  }
}

async function apiPatchJson(path, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response, "API 更新失敗");
  } catch (error) {
    return {
      success: false,
      message: "API 更新失敗",
    };
  }
}

async function apiDeleteJson(path, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return parseJsonResponse(response, "API 刪除失敗");
  } catch (error) {
    return {
      success: false,
      message: "API 刪除失敗",
    };
  }
}
