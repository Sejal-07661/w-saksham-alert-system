import axios from "axios";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

const USER_AGENT = "WSakshamAlertSystem/1.0 (student project; contact: sejalsomkuwar4@gmail.com)";

const headers = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "en",
  "Referer": "http://localhost:3000",
};

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
    params: {
      q: address,
      format: "json",
      limit: 1,
    },
    headers,
  });

  if (!response.data || response.data.length === 0) {
    return null;
  }

  const result = response.data[0];
  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    displayName: result.display_name,
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const response = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
    params: {
      lat: latitude,
      lon: longitude,
      format: "json",
    },
    headers,
  });

  if (!response.data || !response.data.display_name) {
    return null;
  }

  return response.data.display_name;
}