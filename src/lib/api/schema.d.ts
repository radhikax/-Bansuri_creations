// GENERATED from server/openapi.json — do not edit; run npm run api:types
export interface paths {
    "/api/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listCategories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listProducts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/products/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getProduct"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/settings/shipping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getShippingSettings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/razorpay-webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["razorpayWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["adminLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["adminLogout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["adminChangePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["adminGetSettings"];
        put: operations["adminUpdateSettings"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["adminListProducts"];
        put?: never;
        post: operations["adminCreateProduct"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/products/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["adminUpdateProduct"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/products/{id}/variants/{variantId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["adminUpdateVariant"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["adminListCategories"];
        put?: never;
        post: operations["adminCreateCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["adminUpdateCategory"];
        post?: never;
        delete: operations["adminDeleteCategory"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["adminListOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["adminUpdateOrderStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: never;
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listCategories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of categories */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        imageUrl: string;
                        icon: string;
                        createdAt: string;
                        updatedAt: string;
                    }[];
                };
            };
        };
    };
    listProducts: {
        parameters: {
            query?: {
                category?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description List of active products */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        categoryId: string;
                        basePrice: number;
                        originalPrice: number | null;
                        imageUrl: string;
                        images: string[];
                        rating: number;
                        isActive: boolean;
                        createdAt: string;
                        updatedAt: string;
                        variants: {
                            id: string;
                            productId: string;
                            label: string;
                            price: number | null;
                            stock: number;
                            sku: string;
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        category: {
                            id: string;
                            name: string;
                            slug: string;
                            description: string;
                            imageUrl: string;
                            icon: string;
                            createdAt: string;
                            updatedAt: string;
                        };
                    }[];
                };
            };
        };
    };
    getProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Product detail */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        categoryId: string;
                        basePrice: number;
                        originalPrice: number | null;
                        imageUrl: string;
                        images: string[];
                        rating: number;
                        isActive: boolean;
                        createdAt: string;
                        updatedAt: string;
                        variants: {
                            id: string;
                            productId: string;
                            label: string;
                            price: number | null;
                            stock: number;
                            sku: string;
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        category: {
                            id: string;
                            name: string;
                            slug: string;
                            description: string;
                            imageUrl: string;
                            icon: string;
                            createdAt: string;
                            updatedAt: string;
                        };
                    };
                };
            };
            /** @description Product not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    getShippingSettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current shipping configuration */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        flatShippingFee: number;
                        freeShippingThreshold: number;
                    };
                };
            };
        };
    };
    createOrder: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    customerName: string;
                    customerPhone: string;
                    /** Format: email */
                    customerEmail: string;
                    addressStreet: string;
                    addressCity: string;
                    addressState: string;
                    addressPincode: string;
                    items: {
                        variantId: string;
                        quantity: number;
                    }[];
                };
            };
        };
        responses: {
            /** @description Order created and a Razorpay order opened for payment */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        orderId: string;
                        orderNumber: string;
                        razorpayOrderId: string;
                        razorpayKeyId?: string;
                        amount: number;
                    };
                };
            };
            /** @description Invalid order payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Stock validation failed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    getOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order detail */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        orderNumber: string;
                        customerName: string;
                        customerPhone: string;
                        customerEmail: string;
                        addressStreet: string;
                        addressCity: string;
                        addressState: string;
                        addressPincode: string;
                        subtotal: number;
                        shippingFee: number;
                        total: number;
                        /** @enum {string} */
                        status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
                        razorpayOrderId: string | null;
                        razorpayPaymentId: string | null;
                        paidAt: string | null;
                        createdAt: string;
                        updatedAt: string;
                        items: {
                            id: string;
                            orderId: string;
                            productVariantId: string;
                            productNameSnapshot: string;
                            variantLabelSnapshot: string;
                            unitPrice: number;
                            quantity: number;
                        }[];
                    };
                };
            };
            /** @description Order not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    razorpayWebhook: {
        parameters: {
            query?: never;
            header: {
                "x-razorpay-signature": string;
            };
            path?: never;
            cookie?: never;
        };
        /** @description Raw Razorpay webhook payload (signature-verified JSON) */
        requestBody?: {
            content: {
                "application/json": unknown;
            };
        };
        responses: {
            /** @description Webhook acknowledged */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        received: boolean;
                    };
                };
            };
            /** @description Invalid signature */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Webhook processing failed */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** Format: email */
                    email: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description Logged in; sets the admin_session cookie */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        success: boolean;
                    };
                };
            };
            /** @description Email and password required */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Invalid credentials */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Too many failed login attempts for this account; try again in 15 minutes */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminLogout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Logged out; clears the admin_session cookie */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        success: boolean;
                    };
                };
            };
        };
    };
    adminChangePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    currentPassword: string;
                    newPassword: string;
                };
            };
        };
        responses: {
            /** @description Password changed; reissues the admin_session cookie */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        success: boolean;
                    };
                };
            };
            /** @description Invalid payload, or new password too weak / unchanged */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Current password is incorrect, or not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Too many failed password attempts; try again in 15 minutes */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminGetSettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Store settings */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: number;
                        flatShippingFee: number;
                        freeShippingThreshold: number;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminUpdateSettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    flatShippingFee: number;
                    freeShippingThreshold: number;
                };
            };
        };
        responses: {
            /** @description Store settings updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: number;
                        flatShippingFee: number;
                        freeShippingThreshold: number;
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminListProducts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All products (active and inactive), with variants and category */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        categoryId: string;
                        basePrice: number;
                        originalPrice: number | null;
                        imageUrl: string;
                        images: string[];
                        rating: number;
                        isActive: boolean;
                        createdAt: string;
                        updatedAt: string;
                        variants: {
                            id: string;
                            productId: string;
                            label: string;
                            price: number | null;
                            stock: number;
                            sku: string;
                            createdAt: string;
                            updatedAt: string;
                        }[];
                        category: {
                            id: string;
                            name: string;
                            slug: string;
                            description: string;
                            imageUrl: string;
                            icon: string;
                            createdAt: string;
                            updatedAt: string;
                        };
                    }[];
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminCreateProduct: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    name: string;
                    slug: string;
                    description: string;
                    categoryId: string;
                    basePrice: number;
                    originalPrice?: number;
                    imageUrl: string;
                    images?: string[];
                    variants: {
                        label: string;
                        price?: number;
                        stock: number;
                        sku: string;
                    }[];
                };
            };
        };
        responses: {
            /** @description Product created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        categoryId: string;
                        basePrice: number;
                        originalPrice: number | null;
                        imageUrl: string;
                        images: string[];
                        rating: number;
                        isActive: boolean;
                        createdAt: string;
                        updatedAt: string;
                        variants: {
                            id: string;
                            productId: string;
                            label: string;
                            price: number | null;
                            stock: number;
                            sku: string;
                            createdAt: string;
                            updatedAt: string;
                        }[];
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminUpdateProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    name?: string;
                    description?: string;
                    categoryId?: string;
                    basePrice?: number;
                    originalPrice?: number | null;
                    imageUrl?: string;
                    images?: string[];
                    isActive?: boolean;
                };
            };
        };
        responses: {
            /** @description Product updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        categoryId: string;
                        basePrice: number;
                        originalPrice: number | null;
                        imageUrl: string;
                        images: string[];
                        rating: number;
                        isActive: boolean;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminUpdateVariant: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                variantId: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    label: string;
                    price?: number;
                    stock: number;
                    sku: string;
                    id?: string;
                };
            };
        };
        responses: {
            /** @description Variant updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        productId: string;
                        label: string;
                        price: number | null;
                        stock: number;
                        sku: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminListCategories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All categories */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        imageUrl: string;
                        icon: string;
                        createdAt: string;
                        updatedAt: string;
                    }[];
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminCreateCategory: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    name: string;
                    slug: string;
                    description: string;
                    imageUrl: string;
                    icon: string;
                };
            };
        };
        responses: {
            /** @description Category created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        imageUrl: string;
                        icon: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminUpdateCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    name?: string;
                    slug?: string;
                    description?: string;
                    imageUrl?: string;
                    icon?: string;
                };
            };
        };
        responses: {
            /** @description Category updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        slug: string;
                        description: string;
                        imageUrl: string;
                        icon: string;
                        createdAt: string;
                        updatedAt: string;
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminDeleteCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Category deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminListOrders: {
        parameters: {
            query?: {
                status?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Orders, optionally filtered by status */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        orderNumber: string;
                        customerName: string;
                        customerPhone: string;
                        customerEmail: string;
                        addressStreet: string;
                        addressCity: string;
                        addressState: string;
                        addressPincode: string;
                        subtotal: number;
                        shippingFee: number;
                        total: number;
                        /** @enum {string} */
                        status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
                        razorpayOrderId: string | null;
                        razorpayPaymentId: string | null;
                        paidAt: string | null;
                        createdAt: string;
                        updatedAt: string;
                        items: {
                            id: string;
                            orderId: string;
                            productVariantId: string;
                            productNameSnapshot: string;
                            variantLabelSnapshot: string;
                            unitPrice: number;
                            quantity: number;
                        }[];
                    }[];
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    adminUpdateOrderStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
                };
            };
        };
        responses: {
            /** @description Order status updated */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        orderNumber: string;
                        customerName: string;
                        customerPhone: string;
                        customerEmail: string;
                        addressStreet: string;
                        addressCity: string;
                        addressState: string;
                        addressPincode: string;
                        subtotal: number;
                        shippingFee: number;
                        total: number;
                        /** @enum {string} */
                        status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
                        razorpayOrderId: string | null;
                        razorpayPaymentId: string | null;
                        paidAt: string | null;
                        createdAt: string;
                        updatedAt: string;
                        items: {
                            id: string;
                            orderId: string;
                            productVariantId: string;
                            productNameSnapshot: string;
                            variantLabelSnapshot: string;
                            unitPrice: number;
                            quantity: number;
                        }[];
                    };
                };
            };
            /** @description Invalid payload */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Not authenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Order not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
            /** @description Status change not allowed (a CANCELLED order is final; an unpaid PENDING order can only be cancelled) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        error: string;
                        details?: unknown;
                    };
                };
            };
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service is healthy */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @enum {string} */
                        status: "ok";
                    };
                };
            };
        };
    };
}
