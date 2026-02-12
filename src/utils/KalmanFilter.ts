/**
 * 2D Kalman Filter for GPS Position Smoothing
 * 
 * State vector: [lat, lon, vLat, vLon]
 * - Predicts position using velocity model
 * - Corrects with GPS observations
 * - Dynamically adjusts measurement noise based on GPS accuracy
 * 
 * Kotlin版 GnssManager + KalmanFilter の Web移植
 */

export interface KalmanState {
    lat: number;
    lon: number;
    vLat: number;
    vLon: number;
}

export class KalmanFilter2D {
    // State: [lat, lon, vLat, vLon]
    private x: number[];
    // State covariance matrix (4x4)
    private P: number[][];
    // Process noise scalar
    private readonly processNoise: number;
    // Whether filter has been initialized
    private initialized: boolean;
    private lastTimestamp: number;

    constructor(processNoise: number = 1e-8) {
        this.processNoise = processNoise;
        this.x = [0, 0, 0, 0];
        this.P = this.identity4(1);
        this.initialized = false;
        this.lastTimestamp = 0;
    }

    /**
     * Initialize filter with first GPS observation
     */
    init(lat: number, lon: number, timestamp: number): void {
        this.x = [lat, lon, 0, 0];
        // Initial covariance — high uncertainty in velocity
        this.P = [
            [1e-6, 0, 0, 0],
            [0, 1e-6, 0, 0],
            [0, 0, 1e-4, 0],
            [0, 0, 0, 1e-4],
        ];
        this.lastTimestamp = timestamp;
        this.initialized = true;
    }

    /**
     * Predict step — advance state using velocity model
     * Called on each animation frame or sensor update
     */
    predict(timestamp: number): void {
        if (!this.initialized) return;

        const dt = (timestamp - this.lastTimestamp) / 1000; // seconds
        if (dt <= 0 || dt > 5) {
            // Skip unreasonable time deltas
            this.lastTimestamp = timestamp;
            return;
        }
        this.lastTimestamp = timestamp;

        // State transition: x_new = F * x
        // lat += vLat * dt, lon += vLon * dt
        this.x[0] += this.x[2] * dt;
        this.x[1] += this.x[3] * dt;

        // F matrix
        const F = [
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ];

        // Q (process noise)
        const q = this.processNoise;
        const dt2 = dt * dt;
        const dt3 = dt2 * dt / 2;
        const dt4 = dt2 * dt2 / 4;
        const Q = [
            [q * dt4, 0, q * dt3, 0],
            [0, q * dt4, 0, q * dt3],
            [q * dt3, 0, q * dt2, 0],
            [0, q * dt3, 0, q * dt2],
        ];

        // P = F * P * F^T + Q
        this.P = this.addMat(this.mulMat(this.mulMat(F, this.P), this.transpose(F)), Q);
    }

    /**
     * Update step — correct prediction with GPS observation
     * @param lat GPS latitude
     * @param lon GPS longitude
     * @param accuracy GPS accuracy in meters (used to scale R)
     */
    update(lat: number, lon: number, accuracy: number = 10): void {
        if (!this.initialized) {
            this.init(lat, lon, Date.now());
            return;
        }

        // Measurement noise R — derived from GPS accuracy
        // Convert accuracy (meters) to approximate degree noise
        // 1 degree ≈ 111,000 meters
        const degNoise = accuracy / 111000;
        const r = degNoise * degNoise;
        const R = [
            [r, 0],
            [0, r],
        ];

        // H matrix (observation = [lat, lon] from state)
        const H = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
        ];

        // Innovation: y = z - H*x
        const y = [lat - this.x[0], lon - this.x[1]];

        // S = H * P * H^T + R
        const HP = this.mulMatRect(H, this.P); // 2x4
        const HT = this.transposeRect(H); // 4x2
        const S = this.addMat2(this.mulMatRect2(HP, HT), R); // 2x2

        // K = P * H^T * S^(-1)
        const PHT = this.mulMatRect4x2(this.P, HT); // 4x2
        const Sinv = this.invert2(S); // 2x2
        const K = this.mulMatRect4x2_2x2(PHT, Sinv); // 4x2

        // x = x + K * y
        for (let i = 0; i < 4; i++) {
            this.x[i] += K[i][0] * y[0] + K[i][1] * y[1];
        }

        // P = (I - K*H) * P
        const KH = this.mulMatRect4x2_2x4(K, H); // 4x4
        const IKH = this.subtractMat(this.identity4(1), KH);
        this.P = this.mulMat(IKH, this.P);
    }

    /**
     * Get current smoothed state
     */
    getState(): KalmanState {
        return {
            lat: this.x[0],
            lon: this.x[1],
            vLat: this.x[2],
            vLon: this.x[3],
        };
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // ========= Matrix utilities (4x4, 2x2, mixed) =========

    private identity4(scale: number): number[][] {
        return [
            [scale, 0, 0, 0],
            [0, scale, 0, 0],
            [0, 0, scale, 0],
            [0, 0, 0, scale],
        ];
    }

    private mulMat(A: number[][], B: number[][]): number[][] {
        const n = A.length;
        const R: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                for (let k = 0; k < n; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }

    private addMat(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((v, j) => v + B[i][j]));
    }

    private subtractMat(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((v, j) => v - B[i][j]));
    }

    private transpose(A: number[][]): number[][] {
        const n = A.length;
        const R: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                R[j][i] = A[i][j];
        return R;
    }

    // 2x4 * 4x4 → 2x4
    private mulMatRect(A: number[][], B: number[][]): number[][] {
        const R: number[][] = [new Array(4).fill(0), new Array(4).fill(0)];
        for (let i = 0; i < 2; i++)
            for (let j = 0; j < 4; j++)
                for (let k = 0; k < 4; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }

    // Transpose 2x4 → 4x2
    private transposeRect(A: number[][]): number[][] {
        const R: number[][] = Array.from({ length: 4 }, () => new Array(2).fill(0));
        for (let i = 0; i < 2; i++)
            for (let j = 0; j < 4; j++)
                R[j][i] = A[i][j];
        return R;
    }

    // 2x4 * 4x2 → 2x2
    private mulMatRect2(A: number[][], B: number[][]): number[][] {
        const R: number[][] = [new Array(2).fill(0), new Array(2).fill(0)];
        for (let i = 0; i < 2; i++)
            for (let j = 0; j < 2; j++)
                for (let k = 0; k < 4; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }

    // 2x2 add
    private addMat2(A: number[][], B: number[][]): number[][] {
        return A.map((row, i) => row.map((v, j) => v + B[i][j]));
    }

    // 2x2 inverse
    private invert2(M: number[][]): number[][] {
        const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
        if (Math.abs(det) < 1e-20) {
            return [[1e10, 0], [0, 1e10]]; // Fallback
        }
        const invDet = 1 / det;
        return [
            [M[1][1] * invDet, -M[0][1] * invDet],
            [-M[1][0] * invDet, M[0][0] * invDet],
        ];
    }

    // 4x4 * 4x2 → 4x2
    private mulMatRect4x2(A: number[][], B: number[][]): number[][] {
        const R: number[][] = Array.from({ length: 4 }, () => new Array(2).fill(0));
        for (let i = 0; i < 4; i++)
            for (let j = 0; j < 2; j++)
                for (let k = 0; k < 4; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }

    // 4x2 * 2x2 → 4x2
    private mulMatRect4x2_2x2(A: number[][], B: number[][]): number[][] {
        const R: number[][] = Array.from({ length: 4 }, () => new Array(2).fill(0));
        for (let i = 0; i < 4; i++)
            for (let j = 0; j < 2; j++)
                for (let k = 0; k < 2; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }

    // 4x2 * 2x4 → 4x4
    private mulMatRect4x2_2x4(A: number[][], B: number[][]): number[][] {
        const R: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));
        for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++)
                for (let k = 0; k < 2; k++)
                    R[i][j] += A[i][k] * B[k][j];
        return R;
    }
}
