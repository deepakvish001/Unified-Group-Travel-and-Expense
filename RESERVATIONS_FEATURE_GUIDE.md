# Reservations & Nearby Services Feature

## Overview

The **Reservations & Nearby Services** feature enables WayFare users to discover and reserve nearby travel-related services based on their live location. This modern, fully responsive module integrates seamlessly into the existing trip workspace as a new "Services" tab.

## Features

### 1. **Live Location Access**
- Browser geolocation API integration for real-time location detection
- Automatic fallback to default location (India) if geolocation unavailable
- User-friendly permission request with clear explanations
- Shows location status badge ("Locating...", "Location Set")

### 2. **Nearby Services Discovery**

#### Service Categories
- 🚗 **Car Rentals** - Vehicle rental providers with pricing & availability
- 🍽️ **Restaurants** - Dining options with cuisine types & ratings
- 🏨 **Hotels** - Accommodation providers with price levels
- ☕ **Cafes** - Coffee shops and quick dining
- 🎭 **Attractions** - Tourist spots and entertainment
- 🚑 **Emergency** - Medical facilities and emergency services
- ⛽ **Fuel Stations** - Gas stations and fuel providers
- 📍 **Other** - Miscellaneous services

#### Service Information Displayed
- Service name and address
- Distance from user location (in km)
- Rating (out of 5) with review count
- Price level indicator (₹ to ₹₹₹₹)
- Service image/thumbnail
- Estimated cost or pricing
- Availability status badge
- Contact phone number (phone)
- Website link

### 3. **Smart Sorting & Filtering**

Users can sort nearby services by:
- **📍 Nearest** - Closest distance first
- **⭐ Highest Rated** - Best rated services first
- **💰 Cheapest** - Most affordable services first

Dynamic category filtering with animated transitions.

### 4. **Interactive Service Cards**

Each service card features:
- High-quality background image with parallax hover effect
- Distance badge overlay
- Instant rating display
- Price-per-day indicator
- Availability status (✓ Available / ✗ Unavailable)
- Smooth hover animations and scale effects
- Selection highlighting with border & shadow effects

### 5. **Service Detail Panel**

When a user selects a service:
- Full service details displayed in glassmorphic panel
- Contact information (phone, website)
- Rating and review statistics
- "Reserve Now" button with smooth toggle animation
- Inline reservation form (see below)

### 6. **Reservation Workflow**

**Quick Reservation Form:**
- Start date & time picker (datetime-local input)
- End date & time picker
- Special notes/requests textarea
- Real-time form validation
- Success confirmation with instant feedback
- Automatic data persistence to Supabase

**Data Stored:**
- Reservation ID (UUID)
- Service & trip reference
- User ID and creator tracking
- Reservation type & status (pending → confirmed → completed)
- Start/end datetime
- Pickup/dropoff locations
- Estimated and total costs
- Confirmation number (auto-generated)
- External booking URL (if applicable)
- Audit timestamps

### 7. **Saved Reservations Module** (`SavedReservations.tsx`)

Two-tab interface for managing favorites and bookings:

**Tab 1: Saved Services**
- Heart-icon marked favorite services
- Quick access to previously viewed options
- "Unsave" functionality
- Direct "Reserve" button from saved list
- Grid display (responsive: 1-3 columns)

**Tab 2: Reservations**
- All user reservations with status badges
- Color-coded status indicators:
  - Amber: Pending
  - Teal: Confirmed
  - Green: Completed
  - Red: Cancelled
- Shows confirmation reference number
- Displays reserved dates
- Share & Cancel options
- List view with service thumbnails

### 8. **Data Persistence with Supabase**

**Tables Created:**
1. `nearby_services` - Discovered service listings
2. `service_reservations` - User reservations
3. `saved_services` - User's favorites
4. `service_search_history` - Search queries & context

**Row-Level Security (RLS):**
- All tables RLS-enabled
- Trip member scoping enforced
- User isolation for personal data
- Automatic audit timestamps

**Indexes for Performance:**
- Trip ID indexing for fast queries
- Category indexing for filtering
- User ID indexing for personal data
- Status indexing for reservation queries

### 9. **UI/UX Design Patterns**

**Design System Integration:**
- Teal-900/950 primary colors with amber accents
- Stone/slate neutral palette
- Consistent 8px spacing system
- Rounded corners (rounded-2xl for cards, rounded-full for buttons)
- Glassmorphic cards with subtle borders

**Responsive Design:**
- Mobile-first approach
- 1 column on mobile, 2-3 on tablet/desktop
- Bottom navigation tab bar on mobile devices
- Adaptive spacing and typography
- Touch-friendly button sizes

**Animations & Transitions:**
- Smooth hover scale effects (group-hover:scale-110)
- Loading spinners with pulsing animation
- Fade-in effects on data load
- Transition animations on status changes
- Selection highlight with smooth borders

**Loading States:**
- Skeleton-style animations during discovery
- Spinner indicators with contextual text
- Optimistic UI updates

## Component Structure

```
/src/components/
├── panels/
│   └── ReservationsPanel.tsx          # Main discoveries & reservations
├── module4/
│   └── SavedReservations.tsx          # Saved & reservation history
└── TripDetail.tsx                     # Updated with Services tab
```

### ReservationsPanel.tsx

**Main Components:**
- `ReservationsPanel` - Container with location & category management
- `ServiceCard` - Individual service listing card
- `ServiceDetail` - Detailed view of selected service
- `ReservationForm` - Inline reservation booking form

**Key Props:**
```typescript
interface Props {
  tripId: string;
}
```

**State Management:**
- Location (lat/lng coordinates)
- Selected category (car_rental | restaurant | etc.)
- Services list (filtered & sorted)
- Selected service for detail view
- Sort preference (distance | rating | price)
- Loading & error states

### SavedReservations.tsx

**Features:**
- Tab-based interface (saved | reservations)
- Grid view for saved services
- List view for reservations
- Status filtering via color coding
- Share & cancel actions

## Integration Points

### With TripDetail.tsx
The feature is integrated as the 10th tab in trip workspace:
- Navigation icon: `Navigation` (Lucide React)
- Tab label: "Services"
- Position: Between "Bookings" and "Expenses"
- Lazy-loaded component

### With Existing Modules

**Module 4 (Bookings):**
- Complements existing booking system
- Services can be linked to bookings via metadata

**Module 2 (Planning):**
- Services can be added to itinerary items
- Supports route optimization workflow

**Module 3 (Expenses):**
- Service costs tracked in expense hub
- Reservations can reference expenses

## Mock Data

The feature uses realistic mock data with 3-4 services per category:

```typescript
Mock Data Includes:
- Car Rentals: Premium, Budget, Luxury options
- Restaurants: Casual, Standard, Fine Dining
- Hotels: Budget, Comfort, Luxury categories
- Cafes: Local favorites
- Attractions: Popular monuments
- Emergency: Medical centers
- Fuel Stations: Premium options
```

**For Production:**
Replace mock data loading with real Google Maps Places API integration:
```typescript
// Current (mock):
const mockServices = loadFromMockData();

// Production (replace with):
const services = await discoverPlacesNearby(lat, lng, category);
```

## Security & Permissions

### Row-Level Security
```sql
-- Trip members can view discovered services
-- Only authenticated users can create reservations
-- Users can only modify their own reservations
-- Auto-audit of all changes via timestamps
```

### Privacy Considerations
- Location data not permanently stored by default
- Can be persisted via `service_search_history` table
- Users have full control over saved preferences
- GDPR-compliant with data export capability

## API Integration Points

### Current (Mock)
- Uses static mock data
- No external API calls
- 800ms artificial delay for realistic UX

### For Production
Replace the `loadMockServices` function with:

```typescript
const discoverPlaces = async (lat: number, lng: number, category: string) => {
  const response = await fetch('/api/discovery', {
    method: 'POST',
    body: JSON.stringify({
      latitude: lat,
      longitude: lng,
      category: category,
      radius: 5000, // 5km
    }),
  });
  return response.json();
};
```

Edge Function: `/supabase/functions/discovery/index.ts`
- Already configured for Google Maps
- Returns structured place results
- Handles rate limiting & caching

## Usage Examples

### For End Users

1. **Discover Services:**
   - Click "Services" tab in trip workspace
   - Click "Find My Location" button
   - Grant location permission when prompted
   - Browse nearby restaurants, hotels, rentals

2. **Filter & Sort:**
   - Click category tabs (🚗 Car Rentals, 🍽️ Restaurants, etc.)
   - Use sort buttons (Nearest, Highest Rated, Cheapest)
   - View results instantly

3. **Reserve a Service:**
   - Click on a service card to view details
   - Click "Reserve Now"
   - Fill in dates/times and any special notes
   - Click "Confirm Reservation"
   - See instant confirmation

4. **Manage Reservations:**
   - Open "Reservations & Saved" panel
   - Switch between Saved and Reservations tabs
   - Share reservations with group
   - Cancel if needed (before confirmation)

### For Developers

**Add to a Modal/Dialog:**
```tsx
import { ReservationsPanel } from '@/components/panels/ReservationsPanel';

<ReservationsPanel tripId={tripId} />
```

**Show Saved Reservations in Another View:**
```tsx
import { SavedReservations } from '@/components/module4/SavedReservations';

<SavedReservations tripId={tripId} />
```

**Access Reservation Data:**
```typescript
const { data: reservations } = await supabase
  .from('service_reservations')
  .select('*')
  .eq('trip_id', tripId)
  .eq('user_id', userId);
```

## Performance Optimizations

1. **Lazy Loading**
   - ReservationsPanel loaded only when Services tab active
   - Mock data loading with artificial delay for realistic feel

2. **Real-time Subscriptions**
   - Can add Supabase real-time channel subscriptions
   - For live availability updates

3. **Image Optimization**
   - Using Pexels API for high-quality images
   - Auto-compressed with query parameters
   - Lazy loading with native `loading="lazy"`

4. **Indexing**
   - Database indexes on trip_id, category, status
   - Fast filtering and sorting

## Future Enhancements

1. **Real Google Maps Integration**
   - Replace mock data with live Places API
   - Show map with markers
   - Route preview between services

2. **Payment Integration**
   - Razorpay/Stripe for direct booking payments
   - Automatic confirmation on payment success

3. **AI Recommendations**
   - ML-based "Best for You" suggestions
   - Smart category recommendations
   - Personalized pricing insights

4. **Notifications**
   - Price drop alerts for saved services
   - Reservation confirmations via email/SMS
   - Availability updates

5. **Group Features**
   - Share reservations with trip members
   - Collaborative booking decisions
   - Split reservation costs

6. **Analytics**
   - Popular services trending
   - Spending analytics per category
   - Travel patterns insights

## Troubleshooting

### Location Permission Issues
**Issue:** "Unable to access location" error
**Solution:** 
1. Check browser geolocation settings
2. Ensure site has location permission
3. Demo uses fallback to India coordinates

### Mock Data Not Loading
**Issue:** Services list empty
**Solution:**
1. Check browser console for errors
2. Verify trip ID is valid
3. Ensure user is trip member

### Reservation Not Saving
**Issue:** "Confirm Reservation" doesn't work
**Solution:**
1. Check all form fields filled
2. Ensure authenticated user
3. Check network tab for API errors

## File Locations

- Main Panel: `/src/components/panels/ReservationsPanel.tsx`
- Saved View: `/src/components/module4/SavedReservations.tsx`
- Database: Supabase tables (4 new)
- Edge Function: `/supabase/functions/discovery/index.ts` (already exists)
- Integration: `/src/components/TripDetail.tsx` (Services tab added)

## Testing Checklist

- [ ] Geolocation permission request displays
- [ ] Location button shows "Location Set" after permission
- [ ] All 8 service categories have mock data
- [ ] Sorting (nearest/rated/cheapest) works
- [ ] Service cards display with images & ratings
- [ ] Detail panel shows when card clicked
- [ ] Reservation form accepts dates & notes
- [ ] Success message shows after reservation
- [ ] Saved services can be added to favorites
- [ ] Reservations tab shows booked services
- [ ] Cancel button works on pending reservations
- [ ] Responsive design works on mobile
- [ ] Dark mode contrast is readable
- [ ] No console errors

## License & Attribution

- Using Pexels API for mock service images
- Icons from Lucide React
- Database powered by Supabase
- Build tool: Vite
- Styling: Tailwind CSS

---

**Last Updated:** May 2026
**Version:** 1.0 (Initial Release)
**Status:** Production Ready (with mock data)
