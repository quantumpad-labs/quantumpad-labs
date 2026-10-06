export class Exaflop {
  constructor(private options: { baseUrl: string; apiKey: string }) {}
  private async request(path: string, body?: unknown) {
    const response = await fetch(
      `${this.options.baseUrl.replace(/\/$/, "")}/api/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    return data;
  }
  offers(filters: Record<string, string | number>) {
    return this.request(
      `offers?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]))}`,
    );
  }
  privateOffers(filters: Record<string, string | number>) {
    return this.request(
      `my/offers?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]))}`,
    );
  }
  quote(input: { offerId: string; durationHours: number; disk: number }) {
    return this.request("quotes", input);
  }
  createJob(input: {
    quoteId: string;
    confirmed: true;
    workload: {
      image: string;
      command: string;
      disk: number;
      env: Record<string, string>;
    };
  }) {
    return this.request("jobs", input);
  }
  job(id: string) {
    return this.request(`jobs/${encodeURIComponent(id)}`);
  }
  stop(id: string) {
    return this.request(`jobs/${encodeURIComponent(id)}/stop`, {});
  }
}
