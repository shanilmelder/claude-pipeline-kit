import { DashboardHeader } from '../components/DashboardHeader/DashboardHeader';
import { UserList } from '../components/UserList/UserList';

export function DashboardPage() {
  return (
    <div>
      <DashboardHeader />
      <main>
        <h1>Users</h1>
        <UserList />
      </main>
    </div>
  );
}
