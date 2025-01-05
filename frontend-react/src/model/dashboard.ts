

export interface Dashboard {
    id: number;
    name: string
    createdAt?: string;
    updatedAt?: string;
    favorite: boolean
    home: boolean
}

export interface DashboardInput {
    name: string
    favorite: boolean
}
