import { useEffect, useMemo, useState } from 'react';
import { fetchUsers, User } from '../../services/usersService';
import styles from './UserList.module.css';

const PAGE_SIZE = 10;
const UNABLE_TO_LOAD_MESSAGE = 'Unable to load users, please try again';
const NO_USERS_MESSAGE = 'No users found';

type SortKey = 'name' | 'email' | 'role';
type SortDirection = 'asc' | 'desc';

interface Column {
  key: SortKey;
  label: string;
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
];

/**
 * Dashboard user list (KAN-3, AC6-13): fetches users from the mock
 * usersService and renders loading/empty/error/populated states, with a
 * text filter (Name/Email), one sortable column at a time, and fixed-size
 * client-side pagination. No real API/data model exists yet, so this reads
 * from usersService's hardcoded mock list.
 */
export function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    fetchUsers()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setUsers(data);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length === 0) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  }, [users, searchTerm]);

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers].sort((a, b) => {
      const comparison = a[sortKey].localeCompare(b[sortKey]);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredUsers, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = sortedUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    (currentPage - 1) * PAGE_SIZE + PAGE_SIZE,
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.state} aria-busy="true">
          <span className={styles.spinner} aria-hidden="true" />
          <p>Loading users&hellip;</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <p role="alert" className={`${styles.state} ${styles.error}`}>
          {UNABLE_TO_LOAD_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <input
          id="user-search"
          type="search"
          placeholder="Search by name or email"
          aria-label="Search users"
          className={styles.searchInput}
          value={searchTerm}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
      </div>

      {sortedUsers.length === 0 ? (
        <p className={styles.state}>{NO_USERS_MESSAGE}</p>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} scope="col" aria-sort={
                      sortKey === column.key
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                        {sortKey === column.key && (
                          <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="User list pagination">
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
