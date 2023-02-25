import {
  createContext,
  startTransition,
  Suspense,
  useContext,
  useMemo,
  useState,
} from "react";
import { createCache, Status, useCacheStatus } from "suspense";
import Loader from "../../../components/Loader";

import styles from "./style.module.css";
import { UserStatusBadge } from "./UserStatusBadge";

type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
  };
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
};

const jsonCache = createCache<[], User[]>(async () => {
  const response = await fetch("https://jsonplaceholder.typicode.com/users");
  const json = await response.json();
  const users = json as User[];
  return users.slice(0, 5);
});

export const userProfileCache = createCache<[number], User>(
  async (id: number) => {
    return new Promise((resolve, reject) => {
      const delay = 1_000 + Math.random() * 4_000;
      setTimeout(() => {
        const users = jsonCache.getValue();
        const user = users.find((user) => user.id === id);
        if (user) {
          resolve(user);
        } else {
          reject(`User not found: ${id}`);
        }
      }, delay);
    });
  }
);

export const SelectedUserContext = createContext<{
  selectedUserId: number;
  setSelectedUserId: (username: number) => void;
}>(null as any);

export default function Demo() {
  return (
    <Suspense fallback={<Loader />}>
      <DemoSuspends />
    </Suspense>
  );
}

function DemoSuspends() {
  const users = jsonCache.fetchSuspense();

  const [selectedUserId, setSelectedUserId] = useState<number>(users[0].id);
  const context = useMemo(
    () => ({ selectedUserId, setSelectedUserId }),
    [selectedUserId]
  );

  const [state, setState] = useState<"ready" | "running" | "complete">("ready");

  const handleClick = async () => {
    switch (state) {
      case "ready":
        setState("running");
        await Promise.all(
          users.map(({ id }) => userProfileCache.fetchAsync(id))
        );
        setState("complete");
        break;
      case "complete":
        users.map(({ id }) => userProfileCache.evict(id));
        setState("ready");
        break;
    }
  };

  let label;
  switch (state) {
    case "ready":
      label = "Start demo";
      break;
    case "running":
      label = "Loading data";
      break;
    case "complete":
      label = "Reset demo";
      break;
  }

  return (
    <SelectedUserContext.Provider value={context}>
      <button
        className={styles.MainButton}
        disabled={state === "running"}
        onClick={handleClick}
      >
        {label}
      </button>

      <section className={styles.App}>
        <nav className={styles.SideNav}>
          {users.map((user) => (
            <UserLink key={user.id} id={user.id} name={user.name} />
          ))}
        </nav>
        <main className={styles.Main}>
          <Suspense>
            <UserProfile id={selectedUserId} />
          </Suspense>
        </main>
      </section>
    </SelectedUserContext.Provider>
  );
}

function UserProfile({ id }: { id: number }) {
  const userProfile = id ? userProfileCache.fetchSuspense(id) : null;

  return (
    <>
      <h3 className={styles.Header}>{userProfile.name}</h3>
      <ul>
        <li>
          <label>Address</label>: {userProfile.address.street},{" "}
          {userProfile.address.city}, {userProfile.address.zipcode}
        </li>
        <li>
          <label>Phone</label>: {userProfile.phone}
        </li>
        <li>
          <label>Website</label>: {userProfile.website}
        </li>
      </ul>
    </>
  );
}

function UserLink({ id, name }: { id: number; name: string }) {
  const { selectedUserId, setSelectedUserId } = useContext(SelectedUserContext);

  const isCurrent = id === selectedUserId;

  const status = useCacheStatus(userProfileCache, id);

  const handleClick = () => {
    startTransition(() => setSelectedUserId(id));
  };

  return (
    <button
      className={styles.UserButton}
      data-current={isCurrent || undefined}
      data-status={status}
      onClick={handleClick}
    >
      <UserStatusBadge id={id} /> {name}
    </button>
  );
}
