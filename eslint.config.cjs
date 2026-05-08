module.exports = [
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
		globals: {
			window: 'readonly',
			document: 'readonly',
			navigator: 'readonly',
			fetch: 'readonly',
			URL: 'readonly',
			URLSearchParams: 'readonly',
			localStorage: 'readonly',
			sessionStorage: 'readonly',
			journaler: 'writable'
		}
		},
		rules: {
			'no-console': ['warn', { allow: ['log', 'warn','error','info'] }],
			'no-debugger': 'warn',
			'no-var': 'error',
			'prefer-const': ['warn', { destructuring: 'all' }],
			'quotes': ['warn', 'double', { avoidEscape: true, allowTemplateLiterals: true }],
			'semi': ['error', 'always'],
			'indent': ['warn', 'tab', { SwitchCase: 1, VariableDeclarator: 1, outerIIFEBody: 1 }],
			'comma-dangle': ['warn', 'always-multiline'],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
		}
	}
];
