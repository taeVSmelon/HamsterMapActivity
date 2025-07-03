import heapq
import pygame

# --- AStarPathfinder Class (จากโค้ดเดิม) ---
class AStarPathfinder:
    def __init__(self, grid):
        """
        เริ่มต้น A* Pathfinder ด้วยแผนที่แบบกริด

        :param grid: รายการของรายการ (list of lists) แทนแผนที่
                     0: ช่องว่าง (เดินได้)
                     1: สิ่งกีดขวาง (เดินไม่ได้)
                     คุณสามารถเพิ่มค่าอื่น ๆ เพื่อเป็น "ค่าใช้จ่าย" ในการเดินทางได้
                     ตัวอย่าง: 0 = ทางปกติ (cost 1), 2 = พุ่มไม้ (cost 5), 1 = กำแพง (cost infinity)
        """
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0]) if self.rows > 0 else 0

        # ทิศทางการเคลื่อนที่ (8 ทิศทาง: บน, ล่าง, ซ้าย, ขวา, และแนวทแยง)
        # (dy, dx, cost)
        self.directions = [
            (-1, 0, 1),   # Up
            (1, 0, 1),    # Down
            (0, -1, 1),   # Left
            (0, 1, 1),    # Right
            (-1, -1, 1.414), # Up-Left (sqrt(2) approx)
            (-1, 1, 1.414),  # Up-Right
            (1, -1, 1.414),  # Down-Left
            (1, 1, 1.414)    # Down-Right
        ]

    def _is_valid(self, r, c):
        """ตรวจสอบว่าตำแหน่ง (r, c) อยู่ในขอบเขตของกริดหรือไม่"""
        return 0 <= r < self.rows and 0 <= c < self.cols

    def _get_cost(self, r, c):
        """
        คืนค่าใช้จ่ายในการเดินผ่านช่อง (r, c)
        คุณสามารถปรับแต่งฟังก์ชันนี้เพื่อให้แต่ละประเภทของพื้นที่มีค่าใช้จ่ายต่างกัน
        """
        if not self._is_valid(r, c):
            return float('inf') # ถ้านอกขอบเขต ถือว่าเป็นสิ่งกีดขวาง

        cell_value = self.grid[r][c]
        if cell_value == 1:
            return float('inf') # 1 คือสิ่งกีดขวาง เดินไม่ได้
        elif cell_value == 0:
            return 1 # 0 คือทางปกติ ค่าใช้จ่าย 1
        else:
            # คุณสามารถเพิ่มเงื่อนไขสำหรับค่าอื่น ๆ เช่น
            # if cell_value == 2: return 5 # พุ่มไม้ มีค่าใช้จ่าย 5
            return 1 # ค่าเริ่มต้นสำหรับช่องว่างอื่นๆ

    def _heuristic(self, node, target):
        """
        ฟังก์ชัน Heuristic (Manhattan Distance หรือ Euclidean Distance)
        ใช้ในการประมาณระยะทางจาก node ไปยัง target
        """
        # Euclidean Distance: sqrt((x1 - x2)^2 + (y1 - y2)^2)
        # เหมาะสำหรับ 8 ทิศทาง
        return ((node[0] - target[0])**2 + (node[1] - target[1])**2)**0.5

    def find_path(self, start, target):
        """
        ค้นหาเส้นทางที่สั้นที่สุดจาก start ไปยัง target โดยใช้อัลกอริทึม A*

        :param start: tuple (row, col) ของจุดเริ่มต้น
        :param target: tuple (row, col) ของจุดหมายปลายทาง
        :return: รายการของ tuple (row, col) ที่เป็นเส้นทาง หรือ None ถ้าไม่พบเส้นทาง
        """
        if not self._is_valid(start[0], start[1]) or not self._is_valid(target[0], target[1]):
            print("Error: Start or target is out of grid bounds.")
            return None
        if self._get_cost(start[0], start[1]) == float('inf'):
            print("Error: Start position is an obstacle.")
            return None
        if self._get_cost(target[0], target[1]) == float('inf'):
            print("Error: Target position is an obstacle.")
            return None

        # priority_queue: (f_cost, g_cost, row, col)
        open_set = []
        heapq.heappush(open_set, (0, 0, start[0], start[1])) # (f_cost, g_cost, row, col)

        came_from = {} # เก็บว่า node นี้ถูกเข้าถึงมาจาก node ไหน
        g_scores = { (r, c): float('inf') for r in range(self.rows) for c in range(self.cols) }
        g_scores[start] = 0

        f_scores = { (r, c): float('inf') for r in range(self.rows) for c in range(self.cols) }
        f_scores[start] = self._heuristic(start, target)

        closed_set = set() # เก็บ node ที่สำรวจแล้ว

        while open_set:
            current_f_cost, current_g_cost, r, c = heapq.heappop(open_set)
            current_node = (r, c)

            if current_node == target:
                # Reconstruct path
                path = []
                while current_node in came_from:
                    path.append(current_node)
                    current_node = came_from[current_node]
                path.append(start)
                return path[::-1] # ย้อนกลับเพื่อให้จาก start ไป target

            if current_node in closed_set:
                continue
            closed_set.add(current_node)

            for dr, dc, cost_multiplier in self.directions:
                neighbor_r, neighbor_c = r + dr, c + dc
                neighbor_node = (neighbor_r, neighbor_c)

                move_cost = self._get_cost(neighbor_r, neighbor_c)
                if move_cost == float('inf'): # ถ้าเป็นสิ่งกีดขวาง
                    continue

                # ค่าใช้จ่ายในการเคลื่อนที่ไปยัง neighbor
                tentative_g_score = g_scores[current_node] + (cost_multiplier * move_cost)

                if tentative_g_score < g_scores.get(neighbor_node, float('inf')):
                    came_from[neighbor_node] = current_node
                    g_scores[neighbor_node] = tentative_g_score
                    f_scores[neighbor_node] = tentative_g_score + self._heuristic(neighbor_node, target)
                    heapq.heappush(open_set, (f_scores[neighbor_node], tentative_g_score, neighbor_r, neighbor_c))

        return None # ไม่พบเส้นทาง

# --- Pygame Visualization ---

def visualize_pathfinding(grid, start_pos, target_pos, path):
    """
    แสดงผลเส้นทางที่หาได้โดยใช้ Pygame

    :param grid: แผนที่กริด
    :param start_pos: จุดเริ่มต้น (row, col)
    :param target_pos: จุดเป้าหมาย (row, col)
    :param path: รายการของจุด (row, col) ที่เป็นเส้นทาง
    """
    pygame.init()

    # กำหนดขนาดของเซลล์และหน้าต่าง
    CELL_SIZE = 40
    rows = len(grid)
    cols = len(grid[0])
    WIDTH, HEIGHT = cols * CELL_SIZE, rows * CELL_SIZE
    SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("A* Pathfinding Visualization")

    # กำหนดสี
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)
    GREY = (150, 150, 150)
    BLUE = (0, 0, 255)    # Start
    RED = (255, 0, 0)     # Target
    GREEN = (0, 255, 0)   # Path
    OBSTACLE_COLOR = (50, 50, 50) # สิ่งกีดขวาง

    def draw_grid(screen, grid, path, start, target):
        """วาดกริดและเส้นทางบนหน้าจอ"""
        for r in range(rows):
            for c in range(cols):
                rect = pygame.Rect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                
                # วาดพื้นหลังของเซลล์
                if grid[r][c] == 1: # สิ่งกีดขวาง
                    pygame.draw.rect(screen, OBSTACLE_COLOR, rect)
                else: # ช่องว่าง
                    pygame.draw.rect(screen, WHITE, rect)
                
                # วาดเส้นขอบ
                pygame.draw.rect(screen, GREY, rect, 1) # วาดเส้นขอบ 1 pixel

        # วาดเส้นทาง
        if path:
            for r, c in path:
                if (r, c) == start:
                    color = BLUE
                elif (r, c) == target:
                    color = RED
                else:
                    color = GREEN
                
                # วาดวงกลมเล็กๆ ตรงกลางเซลล์ที่เป็นเส้นทาง
                center_x = c * CELL_SIZE + CELL_SIZE // 2
                center_y = r * CELL_SIZE + CELL_SIZE // 2
                pygame.draw.circle(screen, color, (center_x, center_y), CELL_SIZE // 3)

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        SCREEN.fill(BLACK) # ล้างหน้าจอ
        draw_grid(SCREEN, grid, path, start_pos, target_pos)
        pygame.display.flip() # อัปเดตหน้าจอ

    pygame.quit()

# --- ตัวอย่างการใช้งาน ---
if __name__ == "__main__":
    # แผนที่ตัวอย่าง:
    # 0 = ทางเดินปกติ
    # 1 = กำแพง (สิ่งกีดขวาง)
    # ขนาด 10x10
    grid = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 0, 1, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 1, 1, 1, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 1, 1, 1, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]

    pathfinder = AStarPathfinder(grid)

    # --- ตัวอย่างที่ 1: เส้นทางปกติ ---
    start_pos_1 = (0, 0)
    target_pos_1 = (9, 9)
    print(f"Finding path from {start_pos_1} to {target_pos_1}...")
    path_1 = pathfinder.find_path(start_pos_1, target_pos_1)
    if path_1:
        print(f"Path found with length: {len(path_1)}")
        visualize_pathfinding(grid, start_pos_1, target_pos_1, path_1)
    else:
        print("No path found for example 1.")

    # --- ตัวอย่างที่ 2: เส้นทางซับซ้อน ---
    start_pos_2 = (8, 2)
    target_pos_2 = (2, 2)
    print(f"\nFinding path from {start_pos_2} to {target_pos_2}...")
    path_2 = pathfinder.find_path(start_pos_2, target_pos_2)
    if path_2:
        print(f"Path found with length: {len(path_2)}")
        visualize_pathfinding(grid, start_pos_2, target_pos_2, path_2)
    else:
        print("No path found for example 2.")

    # --- ตัวอย่างที่ 3: เป้าหมายเป็นกำแพง ---
    start_pos_3 = (0, 0)
    target_pos_3 = (1, 1) # กำแพง
    print(f"\nFinding path from {start_pos_3} to {target_pos_3}...")
    path_3 = pathfinder.find_path(start_pos_3, target_pos_3)
    if path_3:
        print(f"Path found with length: {len(path_3)}")
        visualize_pathfinding(grid, start_pos_3, target_pos_3, path_3)
    else:
        print("No path found for example 3 (expected).")

    # --- ตัวอย่างที่ 4: เริ่มต้นเป็นกำแพง ---
    start_pos_4 = (1, 1) # กำแพง
    target_pos_4 = (9, 9)
    print(f"\nFinding path from {start_pos_4} to {target_pos_4}...")
    path_4 = pathfinder.find_path(start_pos_4, target_pos_4)
    if path_4:
        print(f"Path found with length: {len(path_4)}")
        visualize_pathfinding(grid, start_pos_4, target_pos_4, path_4)
    else:
        print("No path found for example 4 (expected).")

