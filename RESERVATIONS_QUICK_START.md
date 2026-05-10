# Quick Start Guide - Reservations Feature

## For Users: How to Book a Service

1. **Open a trip** → Click **Services** tab (🧭 icon)
2. **Get location** → Click **"Find My Location"** button
3. **Browse** → Choose category (Car Rentals, Restaurants, Hotels, etc.)
4. **Sort** → Pick sorting preference (Nearest, Rated, Cheapest)
5. **Select** → Click on a service card to view details
6. **Reserve** → Click **"Reserve Now"** button
7. **Book** → Fill dates/times/notes, then click **"Confirm"**
8. **Manage** → View in **"My Reservations"** tab

---

## For Developers: Quick Integration

### Import Components
```typescript
import { ReservationsPanel } from '@/components/panels/ReservationsPanel';
import { SavedReservations } from '@/components/module4/SavedReservations';
```

### Query Reservations
```typescript
const { data: reservations } = await supabase
  .from('service_reservations')
  .select('*')
  .eq('trip_id', tripId)
  .eq('status', 'confirmed');
```

### Add to Your Page
```typescript
<ReservationsPanel tripId={tripId} />
```

---

## Key Files

| File | Purpose | Size |
|------|---------|------|
| `ReservationsPanel.tsx` | Main discovery UI | 360 lines |
| `SavedReservations.tsx` | Favorites & history | 280 lines |
| Migration SQL | Database schema | 150 lines |
| Feature Guide | Full documentation | 600 lines |

---

## Key Features

✅ Live geolocation access  
✅ 8 service categories  
✅ Smart sorting (distance/rating/price)  
✅ Beautiful service cards  
✅ Quick reservation flow  
✅ Saved favorites  
✅ Booking history  
✅ Real-time Supabase sync  
✅ Mobile responsive  
✅ Dark mode support  

---

## Service Categories

🚗 Car Rentals | 🍽️ Restaurants | 🏨 Hotels | ☕ Cafes | 🎭 Attractions | 🚑 Emergency | ⛽ Fuel | 📍 Other

---

## Tab Location

**TripDetail Workspace Tabs:**
Itinerary > Tasks > Polls > Timeline > Bookings > **Services** ← HERE > Expenses > AI > Chat > Plan

---

## Database Tables

1. `nearby_services` - Service listings
2. `service_reservations` - User bookings
3. `saved_services` - Favorites
4. `service_search_history` - Search queries

All with Row-Level Security enabled.

---

## Next Steps

- **Real API:** Replace mock data with Google Places API
- **Payments:** Add Razorpay/Stripe integration
- **Map:** Add interactive Google Map display
- **AI:** Add personalized recommendations
- **Analytics:** Track popular services & trends

---

For detailed docs, see: **RESERVATIONS_FEATURE_GUIDE.md**
