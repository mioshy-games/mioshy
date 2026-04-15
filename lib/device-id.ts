"use client";

import { v4 as uuidv4 } from "uuid";

const COOKIE = "mioshy_device_id";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function getOrCreateDeviceId() {
  const existing = readCookie(COOKIE);
  if (existing && existing.length > 8) return existing;
  const id = uuidv4();
  writeCookie(COOKIE, id);
  return id;
}

