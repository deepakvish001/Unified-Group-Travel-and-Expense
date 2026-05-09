# MODULE 1 Integration Guide

## Quick Start: Using MODULE 1 Components

### 1. Import and Use UserProfileSetup
```tsx
import { UserProfileSetup } from './components/module1/UserProfileSetup';

// In your app
export function MyApp() {
  return <UserProfileSetup />;
}
```

### 2. Integrate GroupCreationFlow
```tsx
import { GroupCreationFlow } from './components/module1/GroupCreationFlow';
import { useState } from 'react';

export function Dashboard() {
  const [showCreate, setShowCreate] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowCreate(true)}>Create Group</button>
      {showCreate && (
        <GroupCreationFlow
          onClose={() => setShowCreate(false)}
          onCreated={(groupId) => {
            // Redirect to group management
          }}
        />
      )}
    </>
  );
}
```

### 3. Group Management Screen
```tsx
import { GroupManagement } from './components/module1/GroupManagement';

export function GroupPage({ groupId }: { groupId: string }) {
  return (
    <GroupManagement
      groupId={groupId}
      onBack={() => navigate('/dashboard')}
    />
  );
}
```

### 4. Expense Management
```tsx
import { ExpenseCoordination } from './components/module1/ExpenseCoordination';

export function ExpensesTab({ groupId }: { groupId: string }) {
  return <ExpenseCoordination groupId={groupId} />;
}
```

### 5. Tasks and Polls
```tsx
import { TasksAndPolls } from './components/module1/TasksAndPolls';

export function CollaborationTab({ groupId }: { groupId: string }) {
  return <TasksAndPolls groupId={groupId} />;
}
```

### 6. Traveler Vault
```tsx
import { TravelerVault } from './components/module1/TravelerVault';

export function BookingPrep({ groupId }: { groupId: string }) {
  return <TravelerVault groupId={groupId} />;
}
```

### 7. Activity Log
```tsx
import { ActivityLog } from './components/module1/ActivityLog';

export function AuditTrail({ groupId }: { groupId: string }) {
  return <ActivityLog groupId={groupId} limit={50} />;
}
```

---

## Data Access Patterns

### Get User Profile
```tsx
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .maybeSingle();
```

### Get User's Groups
```tsx
const { data } = await supabase
  .from('group_members')
  .select('group_id, groups(*)')
  .eq('user_id', userId);
```

### Get Group Expenses
```tsx
const { data } = await supabase
  .from('expenses')
  .select('*, expense_participants(*)')
  .eq('group_id', groupId)
  .eq('expense_type', 'group');
```

### Get Settlements for Member
```tsx
const { data } = await supabase
  .from('settlements')
  .select('*')
  .eq('group_id', groupId)
  .or(`from_user.eq.${userId},to_user.eq.${userId}`)
  .eq('status', 'pending');
```

### Get Activity Log
```tsx
const { data } = await supabase
  .from('activity_logs')
  .select('*')
  .eq('group_id', groupId)
  .order('created_at', { ascending: false })
  .limit(50);
```

---

## Working with Roles and Responsibilities

### Check User Role
```tsx
const userRole = members.find(m => m.user_id === userId)?.role;
const isAdmin = userRole === 'admin';
const isFinanceManager = userRole === 'finance_manager';
```

### Assign Responsibility
```tsx
await supabase
  .from('group_members')
  .update({ responsibility: 'booking_coordinator' })
  .eq('id', memberId);
```

### Available Responsibilities
```
- booking_coordinator
- event_manager
- food_planner
- navigator
- emergency_coordinator
```

---

## Handling Expenses

### Add Group Expense
```tsx
const { data: expense } = await supabase
  .from('expenses')
  .insert({
    group_id: groupId,
    paid_by: userId,
    title: 'Dinner',
    amount: 2400,
    category: 'food',
    split_type: 'equal',
    expense_type: 'group',
    status: 'normal',
    currency: 'INR'
  })
  .select()
  .maybeSingle();

// Add participants
await supabase
  .from('expense_participants')
  .insert(
    participantIds.map(uid => ({
      expense_id: expense.id,
      user_id: uid,
      split_amount: expense.amount / participantIds.length
    }))
  );
```

### Add Personal Expense
```tsx
// Same as above but expense_type: 'personal'
// This will NOT be shared with group
```

### Raise Dispute
```tsx
await supabase
  .from('expense_disputes')
  .insert({
    expense_id: expenseId,
    raised_by: userId,
    reason: 'I was not part of this expense',
    status: 'open'
  });

// Auto-update expense status
await supabase
  .from('expenses')
  .update({ status: 'disputed' })
  .eq('id', expenseId);
```

---

## Settlement Workflow

### Check Settlements
```tsx
const { data: settlements } = await supabase
  .from('settlements')
  .select('*')
  .eq('group_id', groupId)
  .eq('status', 'pending');
```

### Mark as Settled
```tsx
await supabase
  .from('settlements')
  .update({ status: 'settled', settled_at: new Date().toISOString() })
  .eq('id', settlementId);
```

### Restrict Leave Until Settled
```tsx
const canLeave = !settlements.some(
  s => (s.from_user === userId || s.to_user === userId) && s.status === 'pending'
);
```

---

## Group Invites

### Generate Invite Link
```tsx
const code = Math.random().toString(36).slice(2, 8).toUpperCase();
const token = crypto.randomUUID();

await supabase
  .from('group_invites')
  .insert({
    group_id: groupId,
    invite_code: code,
    invite_link_token: token,
    created_by: userId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    max_joins: 5,
    current_joins: 0
  });

// Share link: /join?invite_token=${token}
```

### Accept Invite
```tsx
const token = new URL(window.location).searchParams.get('invite_token');

if (token && user) {
  // Use RPC or direct query to validate and join
  const { data: invite } = await supabase
    .from('group_invites')
    .select('group_id')
    .eq('invite_link_token', token)
    .gt('expires_at', new Date().toISOString())
    .lt('current_joins', 5)
    .maybeSingle();

  if (invite) {
    await supabase
      .from('group_members')
      .insert({
        group_id: invite.group_id,
        user_id: user.id,
        role: 'member'
      });
  }
}
```

---

## Activity Logging

### Log Action
```tsx
await supabase
  .from('activity_logs')
  .insert({
    group_id: groupId,
    actor_id: userId,
    action_type: 'expense_added',
    description: `${userName} added shared expense ₹${amount}`,
    related_entity_type: 'expense',
    related_entity_id: expenseId
  });
```

### Activity Types
```
- group_created
- expense_added
- expense_notification
- task_assigned
- member_joined
- member_left
- dispute_raised
- settlement_completed
```

---

## Real-Time Subscriptions

### Subscribe to Expenses
```tsx
useEffect(() => {
  const channel = supabase
    .channel(`expenses:${groupId}`)
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` },
      (payload) => {
        // Update local state
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [groupId]);
```

### Subscribe to Activity Log
```tsx
const channel = supabase
  .channel(`activity:${groupId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `group_id=eq.${groupId}` },
    (payload) => {
      setLogs(prev => [payload.new, ...prev]);
    }
  )
  .subscribe();
```

---

## Error Handling

### Try-Catch Pattern
```tsx
try {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expenseData)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No data returned');

  // Success
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

---

## Performance Tips

1. **Use `maybeSingle()` for optional rows** - Avoids errors on empty results
2. **Select only needed columns** - `select('id, name, email')`
3. **Use indexes** - Already created on foreign keys and common filters
4. **Limit activity logs** - Use `limit(50)` to avoid large downloads
5. **Batch operations** - Insert multiple rows at once where possible

---

## RBAC Pattern

### Checking Permissions
```tsx
const isAdmin = member?.role === 'admin';
const isFinanceManager = member?.role === 'finance_manager';
const isMember = member?.role === 'member';

// Conditional rendering
{isAdmin && <AdminPanel />}
{(isAdmin || isFinanceManager) && <ExpenseReview />}
```

### RLS Policies Handle Authorization
All protected resources use RLS policies:
- `SELECT` - Users can view allowed data
- `INSERT` - Users can add data to their roles
- `UPDATE` - Users can modify allowed records
- `DELETE` - Users can delete owned records

**Frontend should still check roles for UX**, but backend RLS enforces security.

---

## Testing Checklist

- [ ] Create group and verify budget calculation
- [ ] Add members via invite link
- [ ] Create group and personal expenses
- [ ] Raise dispute on expense
- [ ] Check member cannot leave with pending settlements
- [ ] Export traveler vault
- [ ] Create and vote on poll
- [ ] Check activity log immutability
- [ ] Verify role-based access
- [ ] Test responsibility assignment

---

## Deployment Notes

1. **Database migrations** - Run before deploying
2. **RLS is enabled** - Security is enforced at DB level
3. **HTTPS required** - Only use over secure connections
4. **Auth tokens** - Supabase manages session tokens
5. **Backup strategy** - Configure Supabase backups

---

## Support

For issues or questions about MODULE 1 implementation:
1. Check `MODULE_1_IMPLEMENTATION.md` for feature details
2. Review component code for usage patterns
3. Check RLS policies in migrations
4. Verify Supabase credentials in `.env`

---

**MODULE 1 is production-ready for MVP launch! 🚀**
