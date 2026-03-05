package com.example.h2v1test.ui.auth

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.h2v1test.AppState
import com.example.h2v1test.data.network.ApiException
import com.example.h2v1test.ui.components.GlassInputField
import com.example.h2v1test.ui.components.glassBackground
import com.example.h2v1test.ui.theme.H2VColors
import kotlinx.coroutines.launch

// MARK: - ViewModel

class AuthViewModel(private val appState: AppState) : ViewModel() {
    var isLogin by mutableStateOf(true)
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var nickname by mutableStateOf("")
    var isLoading by mutableStateOf(false)
    var errorMsg by mutableStateOf<String?>(null)

    val canSubmit: Boolean
        get() = email.isNotBlank() && password.isNotBlank() && (isLogin || nickname.isNotBlank())

    fun submit(onSuccess: () -> Unit) {
        if (!canSubmit || isLoading) return
        isLoading = true
        errorMsg = null
        viewModelScope.launch {
            try {
                val data = if (isLogin) {
                    appState.apiClient.login(email.trim(), password)
                } else {
                    appState.apiClient.register(nickname.trim(), email.trim(), password)
                }
                appState.signIn(data.user, data.tokens.accessToken, data.tokens.refreshToken)
                onSuccess()
            } catch (e: ApiException) {
                errorMsg = e.message
            } catch (e: Exception) {
                errorMsg = e.message ?: "Ошибка сети"
            } finally {
                isLoading = false
            }
        }
    }
}

// MARK: - AuthScreen

@Composable
fun AuthScreen(appState: AppState, onSuccess: () -> Unit) {
    val vm = remember { AuthViewModel(appState) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(H2VColors.AppBgDark)
    ) {
        // Top radial gradient (blue glow)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(340.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            H2VColors.AccentBlue.copy(alpha = 0.07f),
                            Color.Transparent
                        ),
                        radius = 600f
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(80.dp))
            LogoSection(isLogin = vm.isLogin)
            Spacer(Modifier.height(44.dp))
            FormSection(vm = vm, onSuccess = onSuccess)
        }
    }
}

@Composable
private fun LogoSection(isLogin: Boolean) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(
                    Brush.linearGradient(
                        listOf(H2VColors.GradientStart, H2VColors.GradientEnd)
                    )
                )
                .shadow(elevation = 24.dp, shape = RoundedCornerShape(20.dp))
        ) {
            Text(
                text = "H",
                style = TextStyle(
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            )
        }
        Spacer(Modifier.height(12.dp))
        Text(
            text = "H2V",
            style = TextStyle(
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                letterSpacing = (-0.8).sp
            )
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = if (isLogin) "С возвращением" else "Создать аккаунт",
            style = TextStyle(
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.35f)
            )
        )
    }
}

@Composable
private fun FormSection(vm: AuthViewModel, onSuccess: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ModePicker(isLogin = vm.isLogin, onToggle = { vm.isLogin = it })

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            GlassInputField(
                label = "Email",
                value = vm.email,
                onValueChange = { vm.email = it },
                keyboardType = KeyboardType.Email
            )

            AnimatedVisibility(
                visible = !vm.isLogin,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                GlassInputField(
                    label = "Никнейм",
                    value = vm.nickname,
                    onValueChange = { vm.nickname = it }
                )
            }

            GlassInputField(
                label = "Пароль",
                value = vm.password,
                onValueChange = { vm.password = it },
                secure = true,
                keyboardType = KeyboardType.Password
            )
        }

        AnimatedVisibility(
            visible = vm.errorMsg != null,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            vm.errorMsg?.let { err ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .glassBackground(cornerRadius = 10.dp, surfaceAlpha = 0.3f)
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Text("⚠", fontSize = 13.sp)
                    Text(
                        text = err,
                        style = TextStyle(color = H2VColors.DangerRed, fontSize = 13.sp)
                    )
                }
            }
        }

        SubmitButton(
            isLogin = vm.isLogin,
            isLoading = vm.isLoading,
            canSubmit = vm.canSubmit,
            onClick = { vm.submit(onSuccess) }
        )
    }
}

@Composable
private fun ModePicker(isLogin: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .glassBackground(cornerRadius = 14.dp, surfaceAlpha = 0.38f)
            .padding(4.dp)
    ) {
        ModeTab(title = "Войти", active = isLogin, onClick = { onToggle(true) })
        ModeTab(title = "Регистрация", active = !isLogin, onClick = { onToggle(false) })
    }
}

@Composable
private fun RowScope.ModeTab(title: String, active: Boolean, onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(10.dp))
            .then(
                if (active) Modifier
                    .background(Color.White.copy(alpha = 0.13f))
                    .border(0.5.dp, Color.White.copy(0.2f), RoundedCornerShape(10.dp))
                else Modifier
            )
            .clickable(interactionSource = interactionSource, indication = null) { onClick() }
            .padding(vertical = 8.dp)
    ) {
        Text(
            text = title,
            style = TextStyle(
                fontSize = 14.sp,
                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                color = if (active) Color.White.copy(0.9f) else Color.White.copy(0.35f)
            )
        )
    }
}

@Composable
private fun SubmitButton(
    isLogin: Boolean,
    isLoading: Boolean,
    canSubmit: Boolean,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (canSubmit) Color.White.copy(alpha = 0.92f)
                else Color.White.copy(alpha = 0.08f)
            )
            .border(
                0.5.dp,
                if (canSubmit) Color.Transparent else Color.White.copy(0.1f),
                RoundedCornerShape(16.dp)
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = canSubmit && !isLoading
            ) { onClick() }
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = Color.Black,
                modifier = Modifier.size(22.dp),
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = if (isLogin) "Войти" else "Создать аккаунт",
                style = TextStyle(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (canSubmit) Color.Black else Color.White.copy(0.3f)
                )
            )
        }
    }
}
