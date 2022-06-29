const API = "https://api.github.com/gists";
const HEADERS = { "User-Agent": "GistStore", Accept: "application/vnd.github.v3+json" };

export class GistStore {
    /**
     * Cached registry.
     * You can simply set it to `null` to force a refresh in the next `lookup` call.
     */
    public registry: Record<string, string> | null = null;

    /**
     *
     * @param KV The KV store to use, it will be used to store the registry. Only write on you create or delete a gist.
     * @param PAT Your GitHub Personal Access Token, to be used to update, create, or delete a gist.
     * @param registry_key The key to use to store the registry in the KV store.
     */
    constructor(
        private readonly KV: KVNamespace,
        private readonly PAT: string,
        private readonly registry_key = "gists",
    ) {}

    /**
     * Lookup the gist id for the given key.
     * @param key The key to lookup
     * @returns The gist id or undefined if not found.
     */
    public async lookup(key: string): Promise<string | undefined> {
        if (this.registry === null) {
            this.registry =
                (await this.KV.get<Record<string, string>>(this.registry_key, "json")) ?? {};
        }
        return this.registry[key];
    }

    /**
     * Get the content of the gist for the given key.
     * @param key The key to get the value for
     * @returns The content of the gist or undefined if not found.
     */
    public async get(key: string): Promise<string | undefined> {
        const gist = await this.lookup(key);

        if (gist === undefined) {
            return undefined;
        }

        const res = await fetch(`${API}/${gist}`, {
            headers: {
                ...HEADERS,
            },
        });

        if (res.ok !== true) {
            return undefined;
        }

        const data = await res.json<{ files?: { [key: string]: { content?: string } } }>();

        return data?.files?.[key]?.content;
    }

    /**
     * Set the value for the given key.
     * @param key The key to set the value for
     * @param value The value to set
     * @returns true if the value was set, false if not.
     */
    public async set(key: string, value: string): Promise<boolean> {
        const gist = await this.lookup(key);

        if (gist === undefined) {
            return this.create(key, value);
        }

        await fetch(`${API}/${gist}`, {
            method: "PATCH",
            headers: {
                Authorization: `token ${this.PAT}`,
                "Content-Type": "application/json",
                ...HEADERS,
            },
            body: JSON.stringify({ files: { [key]: { content: value } } }),
        });

        return true;
    }

    /**
     * Create a new gist for the given key. Fail if the key already exists.
     * @param key The key to create the gist for
     * @param value The value to set for the gist
     * @returns true if the gist was created, false if not.
     */
    public async create(key: string, value: string): Promise<boolean> {
        if ((await this.lookup(key)) !== undefined) {
            return false;
        }

        const res = await fetch(API, {
            method: "POST",
            headers: {
                Authorization: `token ${this.PAT}`,
                "Content-Type": "application/json",
                ...HEADERS,
            },
            body: JSON.stringify({ public: false, files: { [key]: { content: value } } }),
        });

        if (res.ok !== true) {
            return false;
        }

        const { data } = await res.json();

        if (data === undefined) {
            return false;
        }

        await this.KV.put(this.registry_key, JSON.stringify({ ...this.registry, [key]: data.id }));
        return true;
    }

    /**
     * Delete the gist for the given key.
     * @param key The key to delete the gist for
     * @returns true if the gist was deleted, false if not.
     */
    public async delete(key: string): Promise<boolean> {
        const gist = await this.lookup(key);

        if (gist === undefined) {
            return false;
        }

        await fetch(`${API}/${gist}`, {
            method: "DELETE",
            headers: {
                Authorization: `token ${this.PAT}`,
                ...HEADERS,
            },
        });

        if (this.registry) {
            delete this.registry[key];
        }
        await this.KV.put(this.registry_key, JSON.stringify(this.registry ?? {}));
        return true;
    }
}

export default GistStore;
