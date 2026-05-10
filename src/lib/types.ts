export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string;
  email: string;
  created_at: string;
};

export type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  date_of_birth: string | null;
  gender: string;
  profile_picture_url: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  preferred_seat_type: string;
  food_preference: string;
  travel_style_preferences: string;
  id_verification_status: string;
  masked_id: string;
  created_at: string;
  updated_at: string;
};

export type TripCategory = 'friends' | 'family' | 'college' | 'trekking' | 'corporate' | 'adventure' | 'other';

export type Trip = {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  destination: string;
  description: string;
  category: TripCategory;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  currency: string;
  cover_url: string;
  status: 'planning' | 'active' | 'completed';
  created_at: string;
};

export type TripMember = {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  profile?: Profile;
};

export type ActivityStatus = 'planned' | 'confirmed' | 'ongoing' | 'completed' | 'delayed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type ItineraryItem = {
  id: string;
  trip_id: string;
  day_number: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  title: string;
  location: string;
  notes: string;
  category: 'activity' | 'food' | 'transport' | 'rest';
  status: ActivityStatus;
  priority: Priority;
  assigned_to: string | null;
  estimated_cost: number;
  actual_cost: number;
  created_by: string | null;
  last_edited_by: string | null;
  position: number;
  created_at: string;
  updated_at?: string;
};

export type TripTask = {
  id: string;
  trip_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: Priority;
  assigned_to: string | null;
  deadline: string | null;
  linked_activity_id: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type TripPoll = {
  id: string;
  trip_id: string;
  question: string;
  category: string;
  is_anonymous: boolean;
  allow_multiple: boolean;
  expires_at: string | null;
  is_closed: boolean;
  created_by: string;
  created_at: string;
  options?: TripPollOption[];
};

export type TripPollOption = {
  id: string;
  poll_id: string;
  option_text: string;
  position: number;
  created_at: string;
  vote_count?: number;
  user_voted?: boolean;
};

export type TripPollVote = {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export type TripActivityLog = {
  id: string;
  trip_id: string;
  actor_id: string;
  action_type: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
};

export type TripPresence = {
  id: string;
  trip_id: string;
  user_id: string;
  current_view: string;
  last_seen: string;
  profile?: Profile;
};

export type BookingType = 'train' | 'bus' | 'flight' | 'hotel' | 'activity' | 'car_rental' | 'event_ticket' | 'transport';
export type BookingStatus = 'pending' | 'in_progress' | 'confirmed' | 'cancelled' | 'on_hold' | 'requires_action' | 'proposed';
export type BookingPriority = 'low' | 'medium' | 'high' | 'urgent';

export type Booking = {
  id: string;
  trip_id: string;
  type: BookingType;
  title: string;
  provider: string;
  location: string;
  image_url: string;
  cost: number;
  currency: string;
  booking_date: string | null;
  details: Record<string, unknown>;
  status: BookingStatus;
  priority: BookingPriority;
  assigned_coordinator: string | null;
  booking_deadline: string | null;
  travel_date: string | null;
  estimated_cost: number;
  actual_cost: number;
  linked_expense_id: string | null;
  linked_activity_id: string | null;
  attachments: string[];
  external_booking_url: string;
  booking_reference: string;
  notes: string;
  created_by: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at?: string;
};

export type TravelerProfile = {
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string;
  phone_country_code: string;
  phone_number: string;
  email: string;
  nationality: string;
  seat_preference: string;
  food_preference: string;
  berth_preference: string;
  special_requirements: string;
  id_verified: boolean;
  id_type: string;
  id_last_four: string;
  id_expiry: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingParticipant = {
  id: string;
  booking_id: string;
  user_id: string;
  participation_status: 'included' | 'excluded';
  excluded_reason: string;
  added_by: string | null;
  added_at: string;
};

export type BookingActivityLog = {
  id: string;
  booking_id: string;
  trip_id: string;
  action: string;
  performed_by: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ExpenseStatus = 'normal' | 'flagged' | 'rejected' | 'under_review';
export type ExpenseType = 'personal' | 'group';
export type ExpenseCategory = 'food' | 'hotel' | 'transport' | 'activities' | 'emergency' | 'shopping' | 'other';

export type Expense = {
  id: string;
  trip_id: string;
  paid_by: string | null;
  title: string;
  category: string;
  amount: number;
  currency: string;
  split_type: 'equal' | 'custom' | 'percentage';
  expense_type: ExpenseType;
  expense_date: string;
  notes: string;
  status: ExpenseStatus;
  receipt_urls: string[];
  created_by: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at?: string;
  splits?: ExpenseSplit[];
};

export type TripAlert = {
  id: string;
  trip_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  settled: boolean;
  settled_at: string | null;
};

export type Message = {
  id: string;
  trip_id: string;
  user_id: string;
  content: string;
  media_urls?: string[];
  reply_to?: string | null;
  is_pinned?: boolean;
  mentions?: string[];
  created_at: string;
  profile?: Profile;
};

export type AISuggestion = {
  id: string;
  trip_id: string;
  type: 'itinerary' | 'budget' | 'packing' | 'tip';
  content: string;
  accepted: boolean;
  created_at: string;
};

// Module 5 Types
export type AIRecommendationType =
  | 'itinerary'
  | 'budget_optimization'
  | 'activity_suggestion'
  | 'hotel_suggestion'
  | 'transport_suggestion'
  | 'itinerary_analysis'
  | 'decision_analysis'
  | 'travel_insight';

export type AIRecommendationStatus = 'generated' | 'accepted' | 'dismissed' | 'partially_applied';

export type AIRecommendation = {
  id: string;
  trip_id: string;
  requested_by: string;
  recommendation_type: AIRecommendationType;
  input_context: Record<string, unknown>;
  generated_content: Record<string, unknown>;
  ai_model: string;
  status: AIRecommendationStatus;
  feedback_rating: number | null;
  feedback_comment: string | null;
  applied_changes: Record<string, unknown>[];
  generation_count: number;
  expires_at: string;
  created_at: string;
};

export type AIActivityLogEntry = {
  id: string;
  trip_id: string;
  recommendation_id: string | null;
  action: string;
  summary: string;
  details: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
};

export type BudgetOptimization = {
  id: string;
  trip_id: string;
  recommendation_id: string | null;
  optimization_type: 'accommodation' | 'transport' | 'food' | 'activity' | 'shopping' | 'other';
  category: string;
  current_option_name: string;
  current_option_cost: number;
  suggested_option_name: string;
  suggested_option_cost: number;
  savings: number;
  reason: string;
  status: 'suggested' | 'applied' | 'dismissed';
  applied_at: string | null;
  created_at: string;
};

export type TravelInsight = {
  id: string;
  trip_id: string;
  insight_type: 'weather' | 'local_events' | 'cost_saving' | 'safety' | 'cultural' | 'timing' | 'budget_trend' | 'group_tips' | 'seasonal';
  title: string;
  content: string;
  relevance: 'high' | 'medium' | 'low';
  actionable: boolean;
  action_label: string | null;
  expires_at: string;
  created_at: string;
};

export type SmartReminder = {
  id: string;
  trip_id: string;
  user_id: string;
  reminder_type: 'booking_deadline' | 'departure' | 'expense_settlement' | 'task_due' | 'pre_activity' | 'document' | 'pre_trip_checklist';
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'acknowledged' | 'snoozed' | 'done';
  snoozed_until: string | null;
  created_at: string;
};

// AI Generation Inputs
export type TripGenerationInput = {
  destination: string;
  memberCount: number;
  budget: number;
  currency: string;
  duration: number;
  tripType: string;
  startDate: string;
  preferences: string[];
  mustVisit?: string;
  avoidActivities?: string;
  dietaryRestrictions?: string[];
  budgetPriority?: string;
  pace?: 'relaxed' | 'moderate' | 'packed';
};

export type GeneratedActivity = {
  time: string;
  title: string;
  description: string;
  duration: string;
  estimatedCost: number;
  costPerPerson: number;
  category: string;
  reason: string;
};

export type GeneratedDay = {
  day: number;
  date: string;
  morning: GeneratedActivity[];
  afternoon: GeneratedActivity[];
  evening: GeneratedActivity[];
  dayTotal: number;
};

export type GeneratedItinerary = {
  destination: string;
  duration: number;
  totalBudget: number;
  estimatedTotal: number;
  currency: string;
  days: GeneratedDay[];
  budgetBreakdown: { accommodation: number; food: number; activities: number; transport: number };
  hotelSuggestions: { name: string; pricePerNight: number; description: string }[];
  transportSuggestions: { type: string; description: string; cost: number }[];
  aiInsights: string[];
};

export type NotificationCategory = 'financial' | 'booking' | 'itinerary' | 'task' | 'poll' | 'general';
export type NotificationPriority = 'critical' | 'important' | 'normal';

export type Notification = {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  priority: NotificationPriority;
  category: NotificationCategory;
  action_url: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  snoozed_until: string | null;
  created_by: string | null;
  created_at: string;
};

export type UserPresence = {
  id: string;
  trip_id: string;
  user_id: string;
  status: 'online' | 'active' | 'away' | 'dnd' | 'in_activity';
  current_view: string;
  is_typing: boolean;
  last_seen: string;
  updated_at: string;
  profile?: Profile;
};

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type TripInvite = {
  id: string;
  trip_id: string;
  token: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  uses: number;
  max_uses: number;
};

export type ItineraryVote = {
  id: string;
  item_id: string;
  user_id: string;
  value: number;
};

export type BookingVote = {
  id: string;
  booking_id: string;
  user_id: string;
  value: number;
};

// MODULE 1 Types
export type Group = {
  id: string;
  name: string;
  description: string;
  created_by: string;
  total_estimated_cost: number;
  expected_members: number;
  cost_per_person: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'finance_manager' | 'member';
  responsibility: 'booking_coordinator' | 'event_manager' | 'food_planner' | 'navigator' | 'emergency_coordinator' | null;
  balance: number;
  settlement_pending: number;
  joined_at: string;
  profile?: UserProfile;
};

export type GroupInvite = {
  id: string;
  group_id: string;
  invite_code: string;
  invite_link_token: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  max_joins: number;
  current_joins: number;
};

export type GroupExpense = {
  id: string;
  group_id: string;
  paid_by: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  currency: string;
  split_type: 'equal' | 'custom' | 'percentage';
  expense_type: 'personal' | 'group';
  status: 'normal' | 'flagged' | 'disputed';
  created_at: string;
  updated_at: string;
  participants?: ExpenseParticipant[];
};

export type ExpenseParticipant = {
  id: string;
  expense_id: string;
  user_id: string;
  split_amount: number;
  created_at: string;
};

export type ExpenseDispute = {
  id: string;
  expense_id: string;
  raised_by: string;
  reason: string;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at: string | null;
};

export type DisputeComment = {
  id: string;
  dispute_id: string;
  user_id: string;
  comment: string;
  created_at: string;
};

export type Task = {
  id: string;
  group_id: string;
  name: string;
  assigned_to: string;
  deadline: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  reminder_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Poll = {
  id: string;
  group_id: string;
  question: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_closed: boolean;
  options?: PollOption[];
};

export type PollOption = {
  id: string;
  poll_id: string;
  option_text: string;
  created_at: string;
  vote_count?: number;
  user_voted?: boolean;
};

export type PollVote = {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  group_id: string;
  actor_id: string;
  action_type: string;
  description: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
};

export type TravelerVault = {
  id: string;
  group_id: string;
  user_id: string;
  full_name: string;
  phone_number: string | null;
  food_preference: string | null;
  seat_preference: string | null;
  created_at: string;
};

export type Settlement = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  status: 'pending' | 'settled';
  created_at: string;
  settled_at: string | null;
};
