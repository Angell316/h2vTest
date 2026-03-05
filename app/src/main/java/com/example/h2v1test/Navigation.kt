package com.example.h2v1test

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Message
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.h2v1test.ui.auth.AuthScreen
import com.example.h2v1test.ui.chat.ChatScreen
import com.example.h2v1test.ui.chatlist.ChatListScreen
import com.example.h2v1test.ui.profile.ProfileScreen
import com.example.h2v1test.ui.theme.H2VColors

sealed class Screen(val route: String) {
    object Auth : Screen("auth")
    object ChatList : Screen("chatlist")
    object Chat : Screen("chat/{chatId}") {
        fun createRoute(chatId: String) = "chat/$chatId"
    }
    object Profile : Screen("profile")
}

enum class AppTab { CHATS, PROFILE }

@Composable
fun AppNavigation(appState: AppState) {
    val navController = rememberNavController()

    LaunchedEffect(appState.isAuthenticated) {
        if (!appState.isAuthenticated) {
            navController.navigate(Screen.Auth.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    val startDestination = if (appState.isAuthenticated) Screen.ChatList.route else Screen.Auth.route

    NavHost(
        navController = navController,
        startDestination = startDestination,
        enterTransition = { slideInHorizontally(tween(280)) { it } },
        exitTransition = { slideOutHorizontally(tween(280)) { -it / 3 } },
        popEnterTransition = { slideInHorizontally(tween(280)) { -it / 3 } },
        popExitTransition = { slideOutHorizontally(tween(280)) { it } }
    ) {
        composable(Screen.Auth.route) {
            AuthScreen(appState = appState, onSuccess = {
                navController.navigate(Screen.ChatList.route) {
                    popUpTo(Screen.Auth.route) { inclusive = true }
                }
            })
        }

        composable(Screen.ChatList.route) {
            MainTabView(
                appState = appState,
                onNavigateToChat = { chatId ->
                    navController.navigate(Screen.Chat.createRoute(chatId))
                }
            )
        }

        composable(
            route = Screen.Chat.route,
            arguments = listOf(navArgument("chatId") { type = NavType.StringType })
        ) { backStack ->
            val chatId = backStack.arguments?.getString("chatId") ?: return@composable
            ChatScreen(
                chatId = chatId,
                appState = appState,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

@Composable
fun MainTabView(
    appState: AppState,
    onNavigateToChat: (String) -> Unit
) {
    var selectedTab by remember { mutableStateOf(AppTab.CHATS) }
    var showTabBar by remember { mutableStateOf(true) }

    Box(modifier = Modifier.fillMaxSize().background(H2VColors.AppBgDark)) {
        when (selectedTab) {
            AppTab.CHATS -> ChatListScreen(
                appState = appState,
                onNavigateToChat = onNavigateToChat,
                onHideTabBar = { showTabBar = false },
                onShowTabBar = { showTabBar = true }
            )
            AppTab.PROFILE -> ProfileScreen(appState = appState)
        }

        AnimatedVisibility(
            visible = showTabBar,
            enter = slideInVertically { it } + fadeIn(),
            exit = slideOutVertically { it } + fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            GlassTabBar(
                selectedTab = selectedTab,
                onTabSelected = { selectedTab = it }
            )
        }
    }
}

@Composable
fun GlassTabBar(
    selectedTab: AppTab,
    onTabSelected: (AppTab) -> Unit
) {
    Row(
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .padding(start = 16.dp, end = 16.dp, bottom = 28.dp)
            .clip(CircleShape)
            .background(H2VColors.GlassSurfaceDark.copy(alpha = 0.52f))
            .border(
                width = 0.5.dp,
                brush = Brush.horizontalGradient(
                    listOf(Color.Transparent, Color.White.copy(0.32f), Color.White.copy(0.22f), Color.Transparent)
                ),
                shape = CircleShape
            )
            .padding(horizontal = 8.dp, vertical = 8.dp)
    ) {
        GlassTabItem(
            icon = Icons.Filled.ChatBubble,
            label = "Чаты",
            isActive = selectedTab == AppTab.CHATS,
            onClick = { onTabSelected(AppTab.CHATS) }
        )
        GlassTabItem(
            icon = Icons.Filled.Person,
            label = "Профиль",
            isActive = selectedTab == AppTab.PROFILE,
            onClick = { onTabSelected(AppTab.PROFILE) }
        )
    }
}

@Composable
fun GlassTabItem(
    icon: ImageVector,
    label: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .then(
                if (isActive) Modifier
                    .background(Color.White.copy(alpha = 0.13f))
                    .border(0.5.dp, Color.White.copy(0.22f), RoundedCornerShape(16.dp))
                else Modifier
            )
            .clickable(interactionSource = interactionSource, indication = null) { onClick() }
            .padding(horizontal = 28.dp, vertical = 6.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (isActive) Color.White.copy(alpha = 0.95f) else Color.White.copy(0.3f),
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            fontSize = 10.sp,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal,
            color = if (isActive) Color.White.copy(0.88f) else Color.White.copy(0.28f)
        )
    }
}
