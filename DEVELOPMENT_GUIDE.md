# Development Guide

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Yarn or npm
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd threejs-gem-game

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Available Scripts
```bash
# Development
yarn dev          # Start development server
yarn build        # Build for production
yarn preview      # Preview production build

# Electron
yarn electron     # Run as Electron app
yarn electron-dev # Run in development mode with Electron
yarn electron-pack # Build Electron app
yarn electron-dist # Build Electron distribution

# Utilities
yarn lint         # Run ESLint
yarn generate-config # Generate configuration
yarn generate-assets # Generate assets
yarn generate-textures # Generate textures
yarn scan-components # Scan components

# Canonical dungeon compiler
yarn typecheck:dungeon # Type-check the UI-free core
yarn test:dungeon # Core unit and regression tests
yarn test:dungeon:property # fast-check invariants
yarn test:dungeon:sweep # Bounded deterministic validation cohort
yarn analyze:dungeon # Expressive-range JSON report
yarn benchmark:dungeon:techniques # Baseline vs valid best-of-N experiment
yarn test:browser:cdp --endpoint http://127.0.0.1:9222 --url-prefix http://127.0.0.1:4173
```

### Canonical Dungeon Workflow

All gameplay topology and geometry changes begin in `src/dungeon-core`. Keep UI,
Three.js, Rapier, Zustand, Electron, DOM, and browser globals outside that
directory. Consumers belong in adapters and must derive from the immutable
`Dungeon`; mutable exploration data belongs in `DungeonRunState`.

See [`docs/dungeon-core.md`](docs/dungeon-core.md) for the public API,
serialization, runtime adapters, and the texture/3D asset-anchor boundary. A
failure must remain reproducible and structured: add its seed to `tests/seeds`
and fix the responsible stage rather than inventing a graph-only repair.

### Authorized Android Chrome Smoke

Only target a device that the owner explicitly authorized, and use its exact
serial on every `adb` command. The production bundle targets Chrome 79 as the
oldest currently verified Android browser baseline.

Build the app, start `yarn preview --host 127.0.0.1 --port 4173` in another
terminal, then run this PowerShell workflow:

```powershell
$authorizedDevice = 'replace-with-authorized-device-serial'
adb -s $authorizedDevice reverse tcp:4173 tcp:4173
adb -s $authorizedDevice shell am start -a android.intent.action.VIEW -d http://127.0.0.1:4173 com.android.chrome
adb -s $authorizedDevice forward tcp:9222 localabstract:chrome_devtools_remote
yarn test:browser:cdp --endpoint http://127.0.0.1:9222 --url-prefix http://127.0.0.1:4173 --wait-ms 60000 --expect-canvas --expect-text "Room: start"
```

The smoke test fails on page exceptions, console errors/assertions, an
incomplete document, or unmet DOM expectations. Clean up using the same exact
serial:

```powershell
adb -s $authorizedDevice reverse --remove tcp:4173
adb -s $authorizedDevice forward --remove tcp:9222
```

## Project Structure

### Directory Layout
```
src/
├── components/          # React components
│   ├── primitives/     # Basic 3D elements
│   │   ├── elements/   # Structural elements
│   │   ├── game-rooms/ # Complete room types
│   │   └── objects/    # Interactive objects
│   ├── puzzles/        # Puzzle components
│   └── ...            # Other components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── store/              # State management
├── algorithms/         # Core algorithms
├── data/               # Static data files
├── themes/             # Theme system
└── runtime/            # Runtime systems
```

### Key Files
- `src/App.tsx` - Main application component
- `src/main.tsx` - Application entry point
- `src/store/gameStore.ts` - Game state management
- `src/store/mapStore.ts` - Map state management
- `src/algorithms/simpleMapGenerator.ts` - Map generation
- `src/types/map.ts` - Core type definitions

## Development Workflow

### 1. Setting Up Development Environment

#### VS Code Extensions (Recommended)
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens
- Prettier - Code formatter
- ESLint

#### Environment Variables
Create `.env.local` for local development:
```env
VITE_APP_TITLE=ThreeJS Gem Game
VITE_APP_VERSION=1.0.0
VITE_APP_DEBUG=true
```

### 2. Component Development

#### Creating a New Component
```typescript
// src/components/MyComponent.tsx
import React from 'react';
import { useGameStore } from '../store/gameStore';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  onAction 
}) => {
  const { playerStats } = useGameStore();
  
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <p>Player Level: {playerStats.level}</p>
      {onAction && (
        <button onClick={onAction}>
          Perform Action
        </button>
      )}
    </div>
  );
};
```

#### Component Best Practices
1. **Use TypeScript interfaces** for props
2. **Use functional components** with hooks
3. **Keep components focused** on single responsibility
4. **Use meaningful names** for components and props
5. **Add JSDoc comments** for complex components

### 3. State Management

#### Using Zustand Stores
```typescript
// Accessing state
const { playerStats, updateStats } = useGameStore();

// Updating state
updateStats({ level: playerStats.level + 1 });

// Subscribing to specific state
const level = useGameStore(state => state.playerStats.level);
```

#### Creating Custom Hooks
```typescript
// src/hooks/usePlayer.ts
import { useGameStore } from '../store/gameStore';

export const usePlayer = () => {
  const { playerStats, updateStats, addExperience } = useGameStore();
  
  const levelUp = () => {
    updateStats({ level: playerStats.level + 1 });
  };
  
  const gainExperience = (amount: number) => {
    addExperience(amount);
  };
  
  return {
    playerStats,
    levelUp,
    gainExperience,
  };
};
```

### 4. 3D Development

#### Creating 3D Components
```typescript
// src/components/My3DComponent.tsx
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

export const My3DComponent: React.FC = () => {
  const meshRef = useRef<Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
};
```

#### Using Three.js with React Three Fiber
```typescript
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';

export const Scene: React.FC = () => {
  return (
    <Canvas>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <My3DComponent />
      <OrbitControls />
      <Environment preset="sunset" />
    </Canvas>
  );
};
```

### 5. Asset Management

#### Adding New Textures
1. Add texture file to `public/textures/`
2. Update `src/data/textureDefinitions.json`
3. Use in components:

```typescript
import { useTexture } from '@react-three/drei';

export const TexturedComponent: React.FC = () => {
  const texture = useTexture('/textures/my-texture.png');
  
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};
```

#### Creating Procedural Textures
```typescript
// src/utils/textureGenerator.ts
export const generateTexture = (width: number, height: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Generate texture data
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const color = generatePixelColor(x, y, width, height);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas.toDataURL();
};
```

### 6. Testing

#### Component Testing
```typescript
// src/components/__tests__/MyComponent.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
  
  it('calls onAction when button is clicked', () => {
    const mockAction = jest.fn();
    render(<MyComponent title="Test" onAction={mockAction} />);
    
    screen.getByRole('button').click();
    expect(mockAction).toHaveBeenCalled();
  });
});
```

#### Store Testing
```typescript
// src/store/__tests__/gameStore.test.ts
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../gameStore';

describe('GameStore', () => {
  it('updates player stats', () => {
    const { result } = renderHook(() => useGameStore());
    
    act(() => {
      result.current.updateStats({ level: 5 });
    });
    
    expect(result.current.playerStats.level).toBe(5);
  });
});
```

### 7. Performance Optimization

#### Memoization
```typescript
import React, { memo, useMemo, useCallback } from 'react';

export const OptimizedComponent = memo<Props>(({ data, onAction }) => {
  const processedData = useMemo(() => {
    return data.map(item => processItem(item));
  }, [data]);
  
  const handleAction = useCallback(() => {
    onAction(processedData);
  }, [onAction, processedData]);
  
  return (
    <div>
      {processedData.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
});
```

#### Code Splitting
```typescript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const App: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
};
```

### 8. Debugging

#### React DevTools
- Install React Developer Tools browser extension
- Use `useDebugValue` for custom hooks
- Add `displayName` to components

#### Three.js Debugging
```typescript
import { useThree } from '@react-three/fiber';

export const DebugComponent: React.FC = () => {
  const { scene, camera, gl } = useThree();
  
  // Add debug helpers
  React.useEffect(() => {
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    return () => {
      scene.remove(axesHelper);
    };
  }, [scene]);
  
  return null;
};
```

#### Console Debugging
```typescript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', { playerStats, currentRoom });
}
```

### 9. Build and Deployment

#### Production Build
```bash
# Build for production
yarn build

# Preview production build
yarn preview
```

#### Electron Build
```bash
# Build Electron app
yarn electron-pack

# Build distribution
yarn electron-dist
```

#### Environment Configuration
```typescript
// vite.config.ts
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.VITE_APP_VERSION': JSON.stringify(process.env.VITE_APP_VERSION),
  },
});
```

### 10. Code Style and Standards

#### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### ESLint Configuration
```javascript
// eslint.config.js
export default [
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
];
```

#### Prettier Configuration
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### 11. Git Workflow

#### Branch Naming
- `feature/component-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/component-name` - Code refactoring
- `docs/update-description` - Documentation updates

#### Commit Messages
```
feat: add new texture painter component
fix: resolve memory leak in room manager
docs: update API documentation
refactor: optimize map generation algorithm
```

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
```

### 12. Troubleshooting

#### Common Issues

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules yarn.lock
yarn install
```

**TypeScript Errors**
```bash
# Check TypeScript configuration
yarn tsc --noEmit
```

**Three.js Issues**
- Check WebGL support
- Verify texture loading
- Check memory usage

**Performance Issues**
- Use React DevTools Profiler
- Check Three.js performance
- Monitor memory usage
- Optimize re-renders

#### Debug Tools
- React Developer Tools
- Three.js Inspector
- Chrome DevTools
- Performance Profiler
- Memory Profiler

### 13. Contributing

#### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

#### Code Review Process
1. Automated checks must pass
2. Manual code review
3. Testing verification
4. Documentation review
5. Performance check

#### Release Process
1. Update version numbers
2. Update changelog
3. Create release branch
4. Build and test
5. Deploy to production
6. Create GitHub release

## Resources

### Documentation
- [React Documentation](https://react.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

### Tools
- [VS Code](https://code.visualstudio.com/)
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/)
- [Three.js Inspector](https://threejs.org/examples/webgl_loader_obj.html)

### Learning Resources
- [Three.js Journey](https://threejs-journey.com/)
- [React Three Fiber Examples](https://docs.pmnd.rs/react-three-fiber/getting-started/examples)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
