package com.ugop.core.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ugop.core.designsystem.LocalUgopExtras
import com.ugop.core.designsystem.UgopColors
import com.ugop.core.designsystem.UgopTheme

// 1. UgopButton
@Composable
fun UgopButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    loading: Boolean = false
) {
    val extras = LocalUgopExtras.current
    val bg = when (variant) {
        ButtonVariant.Primary -> MaterialTheme.colorScheme.primary
        ButtonVariant.Secondary -> Color.Transparent
        ButtonVariant.Accent -> extras.gold
        ButtonVariant.Destructive -> MaterialTheme.colorScheme.error
    }
    val textColor = when (variant) {
        ButtonVariant.Primary, ButtonVariant.Destructive -> Color.White
        ButtonVariant.Secondary -> MaterialTheme.colorScheme.primary
        ButtonVariant.Accent -> UgopColors.Ink
    }

    Button(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = bg, contentColor = textColor)
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = textColor, strokeWidth = 2.dp)
        } else {
            Text(text = text, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
        }
    }
}

enum class ButtonVariant { Primary, Secondary, Accent, Destructive }

// 3. StatCard
@Composable
fun StatCard(
    number: String,
    label: String,
    modifier: Modifier = Modifier
) {
    val extras = LocalUgopExtras.current
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .border(2.dp, extras.gold, CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "🦜", fontSize = 20.sp)
            }
            Column {
                Text(text = number, style = MaterialTheme.typography.displayMedium, fontSize = 28.sp)
                Text(text = label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}

// 4. FeatureCard
@Composable
fun FeatureCard(
    title: String,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isNew: Boolean = false
) {
    val extras = LocalUgopExtras.current
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .border(2.dp, extras.gold, CircleShape)
                    .background(UgopColors.ForestTint),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "📚", fontSize = 26.sp)
            }
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = title, style = MaterialTheme.typography.titleMedium)
                    if (isNew) {
                        Surface(
                            shape = RoundedCornerShape(999.dp),
                            color = extras.gold
                        ) {
                            Text(
                                text = "NEW",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = UgopColors.Ink,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                Text(text = description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}

// 5. HeroCard
@Composable
fun HeroCard(
    title: String,
    body: String,
    modifier: Modifier = Modifier
) {
    val extras = LocalUgopExtras.current
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .background(
                    Brush.linearGradient(
                        colors = listOf(UgopColors.ForestPrimary, UgopColors.ForestLight)
                    )
                )
                .padding(24.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = title, style = MaterialTheme.typography.titleLarge, color = Color.White)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = body, style = MaterialTheme.typography.bodyMedium, color = extras.cream)
                }
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .border(2.dp, extras.gold, CircleShape)
                        .background(UgopColors.SurfaceLight),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "🦜", fontSize = 36.sp)
                }
            }
        }
    }
}

// 8. ActionRequiredBanner
@Composable
fun ActionRequiredBanner(
    count: Int,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val extras = LocalUgopExtras.current
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = extras.goldTint,
        border = BorderStroke(1.dp, extras.gold)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Badge(
                containerColor = UgopColors.BillOrange,
                contentColor = Color.White
            ) {
                Text(text = "$count", fontWeight = FontWeight.Bold)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = "Action Required", style = MaterialTheme.typography.labelSmall, color = UgopColors.BillOrange)
                Text(text = title, style = MaterialTheme.typography.titleMedium, color = UgopColors.Ink)
            }
            Text(text = "→", fontSize = 20.sp, color = UgopColors.Ink)
        }
    }
}

// 13. TarikEmptyState
@Composable
fun TarikEmptyState(
    message: String,
    actionText: String,
    onAction: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterVertically,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(UgopColors.ForestTint),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "🦜", fontSize = 48.sp)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.outline)
        Spacer(modifier = Modifier.height(20.dp))
        UgopButton(text = actionText, onClick = onAction, variant = ButtonVariant.Primary)
    }
}

@Preview(name = "Light Mode")
@Composable
fun UgopComponentsPreview() {
    UgopTheme(darkTheme = false) {
        Surface {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                StatCard(number = "1,420", label = "Enrolled Learners")
                FeatureCard(title = "Class Records", description = "Enter and manage Term 1-3 grades", onClick = {}, isNew = true)
                HeroCard(title = "Maupay nga adlaw, Teacher!", body = "All attendance registers for today have been successfully logged.")
                ActionRequiredBanner(count = 3, title = "Pending student enrollment applications awaiting confirmation", onClick = {})
            }
        }
    }
}
