import heapq
import pygame

# --- AStarPathfinder Class (จากโค้ดเดิม) ---
class AStarPathfinder:
    def __init__(self, grid):
        """
        Initializes the A* Pathfinder with a grid map.

        :param grid: A list of lists representing the map.
                     0: Empty space (walkable)
                     1: Obstacle (unwalkable)
                     You can add other values to represent different "costs" for movement.
                     Example: 0 = normal path (cost 1), 2 = bush (cost 5), 1 = wall (cost infinity)
        """
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0]) if self.rows > 0 else 0

        # Movement directions (8 directions: Up, Down, Left, Right, and diagonals)
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
        """Checks if the position (r, c) is within the grid boundaries."""
        return 0 <= r < self.rows and 0 <= c < self.cols

    def _get_cost(self, r, c):
        """
        Returns the cost of moving through cell (r, c).
        You can customize this function to assign different costs to different terrain types.
        """
        if not self._is_valid(r, c):
            return float('inf') # If out of bounds, treat as an obstacle

        cell_value = self.grid[r][c]
        if cell_value == 1:
            return float('inf') # 1 is an obstacle, unwalkable
        elif cell_value == 0:
            return 1 # 0 is a normal path, cost 1
        else:
            # You can add conditions for other values, e.g.:
            # if cell_value == 2: return 5 # Bush, cost 5
            return 1 # Default cost for other walkable cells

    def _heuristic(self, node, target):
        """
        Heuristic function (Euclidean Distance).
        Used to estimate the distance from the current node to the target.
        """
        # Euclidean Distance: sqrt((x1 - x2)^2 + (y1 - y2)^2)
        # Suitable for 8-directional movement
        return ((node[0] - target[0])**2 + (node[1] - target[1])**2)**0.5

    def find_path(self, start, target):
        """
        Finds the shortest path from start to target using the A* algorithm.

        :param start: tuple (row, col) of the starting point.
        :param target: tuple (row, col) of the target point.
        :return: A list of tuples (row, col) representing the path, or None if no path is found.
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
        # f_cost = g_cost + h_cost (estimated total cost)
        # g_cost = actual cost from start to current node
        # h_cost = heuristic cost from current node to target
        open_set = []
        heapq.heappush(open_set, (0, 0, start[0], start[1])) # (f_cost, g_cost, row, col)

        came_from = {} # Stores which node was used to reach the current node
        g_scores = { (r, c): float('inf') for r in range(self.rows) for c in range(self.cols) }
        g_scores[start] = 0

        f_scores = { (r, c): float('inf') for r in range(self.rows) for c in range(self.cols) }
        f_scores[start] = self._heuristic(start, target)

        closed_set = set() # Stores nodes that have been evaluated

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
                return path[::-1] # Reverse to get path from start to target

            if current_node in closed_set:
                continue
            closed_set.add(current_node)

            for dr, dc, cost_multiplier in self.directions:
                neighbor_r, neighbor_c = r + dr, c + dc
                neighbor_node = (neighbor_r, neighbor_c)

                move_cost = self._get_cost(neighbor_r, neighbor_c)
                if move_cost == float('inf'): # If it's an obstacle
                    continue

                # Cost to move to the neighbor
                tentative_g_score = g_scores[current_node] + (cost_multiplier * move_cost)

                if tentative_g_score < g_scores.get(neighbor_node, float('inf')):
                    came_from[neighbor_node] = current_node
                    g_scores[neighbor_node] = tentative_g_score
                    f_scores[neighbor_node] = tentative_g_score + self._heuristic(neighbor_node, target)
                    heapq.heappush(open_set, (f_scores[neighbor_node], tentative_g_score, neighbor_r, neighbor_c))

        return None # No path found

# --- Enemy Class ---
class Enemy:
    def __init__(self, id, start_pos, pathfinder_instance, color=(255, 165, 0)): # Orange color for enemies
        self.id = id
        self.current_pos = start_pos
        self.target_pos = None # Target for this specific enemy
        self.path = []
        self.pathfinder = pathfinder_instance
        self.color = color

    def set_target(self, target):
        self.target_pos = target
        self.path = self.pathfinder.find_path(self.current_pos, self.target_pos)
        if self.path and len(self.path) > 1:
            self.path.pop(0) # Remove the current position from the path (already there)
        else:
            self.path = [] # No path or path is too short

    def update(self):
        # Enemy movement logic per frame/tick
        if self.path:
            next_step = self.path.pop(0)
            # print(f"Enemy {self.id}: Moving from {self.current_pos} to {next_step}") # Optional: print movement
            self.current_pos = next_step
            if not self.path and self.current_pos == self.target_pos:
                print(f"Enemy {self.id}: Reached target {self.target_pos}!")
        else:
            # If no path, or reached target, stay put or find a new path
            pass

# --- Pygame Visualization ---

def run_game_simulation(grid, pathfinder, enemies, player_target_pos):
    """
    Runs the Pygame simulation to visualize multiple enemies moving along their paths.

    :param grid: The grid map.
    :param pathfinder: An instance of AStarPathfinder.
    :param enemies: A list of Enemy objects.
    :param player_target_pos: The player's fixed target position for enemies.
    """
    pygame.init()

    # Define cell and window size
    CELL_SIZE = 40
    rows = len(grid)
    cols = len(grid[0])
    WIDTH, HEIGHT = cols * CELL_SIZE, rows * CELL_SIZE
    SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("A* Pathfinding Simulation (Multiple Enemies)")

    # Define colors
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)
    GREY = (150, 150, 150)
    PLAYER_TARGET_COLOR = (255, 0, 0) # Red for player's target
    OBSTACLE_COLOR = (50, 50, 50) # Obstacles

    clock = pygame.time.Clock()
    FPS = 10 # Frames per second, controls enemy movement speed

    def draw_grid(screen, grid):
        """Draws the grid on the screen."""
        for r in range(rows):
            for c in range(cols):
                rect = pygame.Rect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
                
                # Draw cell background
                if grid[r][c] == 1: # Obstacle
                    pygame.draw.rect(screen, OBSTACLE_COLOR, rect)
                else: # Empty space
                    pygame.draw.rect(screen, WHITE, rect)
                
                # Draw borders
                pygame.draw.rect(screen, GREY, rect, 1) # Draw 1 pixel border

    def draw_entities(screen, enemies, player_target):
        """Draws enemies and the player's target."""
        # Draw player's target
        if player_target:
            center_x = player_target[1] * CELL_SIZE + CELL_SIZE // 2
            center_y = player_target[0] * CELL_SIZE + CELL_SIZE // 2
            pygame.draw.circle(screen, PLAYER_TARGET_COLOR, (center_x, center_y), CELL_SIZE // 3)
            # You could add a small text label for the target
            font = pygame.font.Font(None, 20)
            text = font.render("Target", True, WHITE)
            text_rect = text.get_rect(center=(center_x, center_y - CELL_SIZE // 2))
            screen.blit(text, text_rect)


        # Draw enemies
        for enemy in enemies:
            center_x = enemy.current_pos[1] * CELL_SIZE + CELL_SIZE // 2
            center_y = enemy.current_pos[0] * CELL_SIZE + CELL_SIZE // 2
            pygame.draw.circle(screen, enemy.color, (center_x, center_y), CELL_SIZE // 3)
            # You could add a small text label for enemy ID
            font = pygame.font.Font(None, 20)
            text = font.render(str(enemy.id), True, BLACK)
            text_rect = text.get_rect(center=(center_x, center_y))
            screen.blit(text, text_rect)


    running = True
    game_tick = 0
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            # Optional: Allow changing target with mouse click
            # if event.type == pygame.MOUSEBUTTONDOWN:
            #     mouse_x, mouse_y = event.pos
            #     new_target_col = mouse_x // CELL_SIZE
            #     new_target_row = mouse_y // CELL_SIZE
            #     if pathfinder._is_valid(new_target_row, new_target_col) and \
            #        pathfinder._get_cost(new_target_row, new_target_col) != float('inf'):
            #         player_target_pos = (new_target_row, new_target_col)
            #         # Recalculate paths for all enemies to the new target
            #         for enemy in enemies:
            #             enemy.set_target(player_target_pos)

        SCREEN.fill(BLACK) # Clear the screen
        draw_grid(SCREEN, grid)
        draw_entities(SCREEN, enemies, player_target_pos)
        pygame.display.flip() # Update the display

        # Update enemy positions
        game_tick += 1
        # print(f"\n--- Game Tick {game_tick} ---") # Optional: print game tick
        for enemy in enemies:
            enemy.update()
        
        clock.tick(FPS) # Control frame rate

    pygame.quit()

# --- Main execution block ---
if __name__ == "__main__":
    # Example map:
    # 0 = normal path
    # 1 = wall (obstacle)
    # Size 10x10
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

    # Player's target position (fixed for this example)
    player_target = (9, 9)

    enemies = []
    enemies.append(Enemy(1, (0, 0), pathfinder, (255, 165, 0))) # Enemy 1 (Orange)
    enemies.append(Enemy(2, (9, 0), pathfinder, (255, 255, 0))) # Enemy 2 (Yellow)
    enemies.append(Enemy(3, (0, 9), pathfinder, (0, 255, 255))) # Enemy 3 (Cyan)

    # Set initial targets for all enemies
    for enemy in enemies:
        enemy.set_target(player_target)

    # Run the simulation
    run_game_simulation(grid, pathfinder, enemies, player_target)

