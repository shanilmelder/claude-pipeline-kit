export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Small artificial delay so the loading state (AC10) is real/testable. */
const FETCH_DELAY_MS = 300;

/**
 * No users API/data model exists yet (KAN-3 stand-in). This returns a small
 * hardcoded list, mirroring authService.ts's async-with-delay shape, so the
 * UI's loading/empty/error states can be built and tested against a
 * realistic contract now and swapped for a real API call later without
 * changing UserList's call site.
 */
const MOCK_USERS: User[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'Admin' },
  { id: '2', name: 'Grace Hopper', email: 'grace@example.com', role: 'Admin' },
  { id: '3', name: 'Alan Turing', email: 'alan@example.com', role: 'Member' },
  { id: '4', name: 'Margaret Hamilton', email: 'margaret@example.com', role: 'Member' },
  { id: '5', name: 'Katherine Johnson', email: 'katherine@example.com', role: 'Member' },
  { id: '6', name: 'Tim Berners-Lee', email: 'tim@example.com', role: 'Viewer' },
  { id: '7', name: 'Radia Perlman', email: 'radia@example.com', role: 'Member' },
  { id: '8', name: 'Barbara Liskov', email: 'barbara@example.com', role: 'Admin' },
  { id: '9', name: 'Dennis Ritchie', email: 'dennis@example.com', role: 'Viewer' },
  { id: '10', name: 'Shafi Goldwasser', email: 'shafi@example.com', role: 'Member' },
  { id: '11', name: 'Donald Knuth', email: 'donald@example.com', role: 'Viewer' },
  { id: '12', name: 'Frances Allen', email: 'frances@example.com', role: 'Member' },
];

export function fetchUsers(): Promise<User[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_USERS]);
    }, FETCH_DELAY_MS);
  });
}
