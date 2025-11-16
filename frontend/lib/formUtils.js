export function toUrlEncoded(obj){
  return Object.keys(obj).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(obj[k]||'')).join('&')
}

export async function postUrlEncoded(url, obj){
  return fetch(url, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: toUrlEncoded(obj), credentials: 'include' })
}

export function validateEmail(email){
  return /\S+@\S+\.\S+/.test(email)
}

export function validateRequired(value){
  if (typeof value === 'string') return value.trim().length > 0
  return !!value
}
