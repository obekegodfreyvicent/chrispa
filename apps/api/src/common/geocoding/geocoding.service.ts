import { Injectable, Logger } from '@nestjs/common';

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
// Nominatim's usage policy requires an identifying User-Agent (not an API
// key — it's a free, keyless service) — see https://operations.osmfoundation.org/policies/nominatim/.
const USER_AGENT = 'ChrisPaScentsAndSoaps/1.0 (hello@chrispa.ug)';

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
  road?: string;
}

// Resolves a Delivery's pickup/delivered GPS coordinates into a short,
// human-readable place name for the receipt/invoice (per user request —
// "GPS location" alone wasn't enough, wanted the actual place named next
// to it). Uses OpenStreetMap's free Nominatim reverse-geocoding service
// rather than Google's paid Geocoding API, matching this codebase's
// existing decision to deep-link to Google Maps instead of pulling in a
// billed maps SDK (see DeliveryService's class comment). Best-effort only
// — a slow/failed lookup must never block a delivery status update, same
// reasoning as MailService/SmsService calls elsewhere (see
// DeliveryService.notifyCustomer()); callers get `null` back and just omit
// the name.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        this.logger.warn(`Reverse geocoding for ${lat},${lng} returned ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { address?: NominatimAddress; display_name?: string };
      const addr = data.address ?? {};
      const area = addr.suburb ?? addr.neighbourhood ?? addr.village ?? addr.town ?? addr.road;
      const city = addr.city ?? addr.county ?? addr.state;
      const name = [area, city].filter(Boolean).join(', ');
      return name || data.display_name || null;
    } catch (err) {
      this.logger.warn(`Reverse geocoding failed for ${lat},${lng}: ${err}`);
      return null;
    }
  }
}
